// ============================================================================
// js/core/gl-calendar-sync.js — Google Calendar Sync Engine
//
// Creates, updates, and deletes Google Calendar events via worker proxy.
// Falls back to prefilled URL when calendar scope is unavailable.
//
// DEPENDS ON: accessToken (firebase-service.js), bandMembers, bandPath,
//             firebaseDB, calBuildRehearsalGoogleLink (calendar-export.js)
//
// EXPOSES: window.GLCalendarSync
// ============================================================================

'use strict';

window.GLCalendarSync = (function() {

  var WORKER_BASE = 'https://deadcetera-proxy.drewmerrill.workers.dev';
  var CAL_DEFAULT_DURATION_MIN = 120;

  // ── Check if calendar scope is available ──────────────────────────────────
  function hasCalendarScope() {
    if (typeof accessToken === 'undefined' || !accessToken) return false;
    if (typeof window._calendarScopeGranted !== 'undefined') return window._calendarScopeGranted;
    return typeof GOOGLE_DRIVE_CONFIG !== 'undefined' &&
      GOOGLE_DRIVE_CONFIG.scope && GOOGLE_DRIVE_CONFIG.scope.indexOf('calendar') !== -1;
  }

  // FreeBusy requires full calendar or calendar.freebusy scope (calendar.events is NOT enough)
  function hasFreeBusyScope() {
    if (typeof accessToken === 'undefined' || !accessToken) return false;
    if (typeof window._calendarFreeBusyGranted !== 'undefined') return window._calendarFreeBusyGranted;
    return false;
  }

  // ── Build Google Calendar event body ──────────────────────────────────────
  function _buildEventBody(glEvent, opts) {
    opts = opts || {};
    var bandName = '';
    if (typeof currentBandName !== 'undefined' && currentBandName) bandName = currentBandName;
    else if (typeof window.currentBandSlug !== 'undefined') bandName = window.currentBandSlug;

    var typeLabel = { rehearsal: 'Rehearsal', gig: 'Gig', meeting: 'Meeting' };
    var summary = (bandName ? bandName + ' ' : '') + (typeLabel[glEvent.type] || 'Event');
    if (glEvent.title && glEvent.title !== 'Band Rehearsal') summary += ' \u2014 ' + glEvent.title;

    // Parse time
    var time = glEvent.time || '19:00';
    var startDt = new Date(glEvent.date + 'T' + time + ':00');
    if (isNaN(startDt.getTime())) startDt = new Date(glEvent.date + 'T19:00:00');
    var endDt = new Date(startDt.getTime() + CAL_DEFAULT_DURATION_MIN * 60000);

    // Description
    var descParts = [];
    if (opts.planSummary) descParts.push('\uD83C\uDFAF ' + opts.planSummary);
    if (glEvent.notes) descParts.push('\uD83D\uDCDD ' + glEvent.notes);
    if (descParts.length) descParts.push('');
    descParts.push('Created with GrooveLinx \u2014 groovelinx.com');

    var body = {
      summary: summary,
      description: descParts.join('\n'),
      start: { dateTime: startDt.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: endDt.toISOString(), timeZone: 'America/New_York' }
    };

    if (glEvent.venue || glEvent.location) {
      body.location = glEvent.venue || glEvent.location;
    }

    // Attendees
    var attendees = opts.attendees || _getBandEmails();
    if (attendees.length) {
      body.attendees = attendees.map(function(email) { return { email: email }; });
    }

    return body;
  }

  function _getBandEmails() {
    var emails = [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    Object.keys(bm).forEach(function(k) {
      if (bm[k] && bm[k].email) emails.push(bm[k].email);
    });
    return emails;
  }

  // ── CREATE event in Google Calendar ───────────────────────────────────────
  async function create(glEvent, opts) {
    if (!hasCalendarScope()) {
      return _fallbackUrl(glEvent, opts);
    }

    var body = _buildEventBody(glEvent, opts);
    var calId = await _getBandCalendarId();

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(calId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        var errText = await res.text();
        console.warn('[CalSync] Create failed:', res.status, errText);
        return { success: false, error: 'Google Calendar returned ' + res.status, fallback: true };
      }

      var data = await res.json();
      var syncObj = {
        provider: 'google',
        externalEventId: data.id,
        calendarId: calId,
        htmlLink: data.htmlLink || null,
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        lastSyncDirection: 'push',
        syncedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
        etag: data.etag || null,
        attendees: _getBandEmails()
      };

      return { success: true, sync: syncObj, htmlLink: data.htmlLink };
    } catch (err) {
      console.warn('[CalSync] Create error:', err);
      return { success: false, error: err.message, fallback: true };
    }
  }

  // ── UPDATE event in Google Calendar ───────────────────────────────────────
  async function update(externalEventId, glEvent, opts) {
    if (!hasCalendarScope() || !externalEventId) {
      return { success: false, error: 'No calendar scope or event ID', fallback: true };
    }

    var body = _buildEventBody(glEvent, opts);
    var calId = await _getBandCalendarId();

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId) + '?calendarId=' + encodeURIComponent(calId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        console.warn('[CalSync] Update failed:', res.status);
        return { success: false, error: 'Update failed: ' + res.status, status: 'error' };
      }

      var data = await res.json();
      return {
        success: true,
        status: 'synced',
        etag: data.etag || null,
        lastSyncedAt: new Date().toISOString()
      };
    } catch (err) {
      console.warn('[CalSync] Update error:', err);
      return { success: false, error: err.message, status: 'error' };
    }
  }

  // ── DELETE event from Google Calendar ─────────────────────────────────────
  async function remove(externalEventId) {
    if (!hasCalendarScope() || !externalEventId) {
      return { success: false, error: 'No calendar scope or event ID' };
    }

    var calId = await _getBandCalendarId();

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId) + '?calendarId=' + encodeURIComponent(calId), {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });

      // 204 = success, 410 = already deleted
      if (res.status === 204 || res.status === 410) {
        return { success: true, status: 'detached' };
      }

      return { success: false, error: 'Delete failed: ' + res.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Fallback: open prefilled URL ──────────────────────────────────────────
  function _fallbackUrl(glEvent, opts) {
    if (typeof calBuildRehearsalGoogleLink === 'function') {
      var url = calBuildRehearsalGoogleLink(glEvent, (opts && opts.planSummary) || '');
      if (url && url !== '#') {
        window.open(url, '_blank');
        return { success: false, fallback: true, opened: true };
      }
    }
    return { success: false, fallback: true, opened: false };
  }

  // ── Save sync state to Firebase event ─────────────────────────────────────
  async function saveSyncState(eventIndex, syncObj) {
    try {
      var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
      if (events[eventIndex]) {
        events[eventIndex].sync = syncObj;
        await saveBandDataToDrive('_band', 'calendar_events', events);
      }
    } catch (e) {
      console.warn('[CalSync] Failed to save sync state:', e);
    }
  }

  // ── Get sync status for an event ──────────────────────────────────────────
  function getSyncStatus(event) {
    if (!event || !event.sync) return 'none';
    return event.sync.status || 'none';
  }

  // ── Render sync state UI ──────────────────────────────────────────────────
  function renderSyncBadge(event, actionContext) {
    var sync = event ? event.sync : null;
    var status = sync ? sync.status : 'none';
    var ctx = actionContext || '';

    if (status === 'synced') {
      var link = sync.htmlLink ? ' <a href="' + sync.htmlLink + '" target="_blank" style="color:#4285f4;text-decoration:underline;font-size:0.9em">Open</a>' : '';
      return '<div style="display:flex;align-items:center;gap:6px;font-size:0.68em;color:#22c55e;padding:3px 0">\u2705 In Google Calendar' + link + '</div>';
    }
    if (status === 'needs_update') {
      return '<div style="display:flex;align-items:center;gap:6px;font-size:0.68em;color:#f59e0b;padding:3px 0">\u26A0 Date changed \u2014 '
        + '<button onclick="GLCalendarSync._retrySync(' + ctx + ')" style="background:none;border:none;color:#4285f4;cursor:pointer;font-weight:600;padding:0;text-decoration:underline;font-size:1em">update calendar</button></div>';
    }
    if (status === 'error') {
      return '<div style="display:flex;align-items:center;gap:6px;font-size:0.68em;color:#ef4444;padding:3px 0">\u274C Couldn\u2019t update Google Calendar \u2014 '
        + '<button onclick="GLCalendarSync._retrySync(' + ctx + ')" style="background:none;border:none;color:#4285f4;cursor:pointer;font-weight:600;padding:0;text-decoration:underline;font-size:1em">Retry</button></div>';
    }
    // 'none' — not synced yet
    return '';
  }

  // ── MULTI-USER GOOGLE CALENDAR SYNC ─────────────────────────────────────
  //
  // ARCHITECTURE:
  //   - Each member's browser has their own OAuth token (via Firebase Auth)
  //   - No Worker-level token storage needed — Worker forwards client token
  //   - Connection records stored in Firebase: bands/{slug}/google_connections/{memberKey}
  //   - Free/busy results shared via Firebase: bands/{slug}/member_freebusy/{memberKey}
  //   - All members read merged results from shared path
  //
  // TOKEN SECURITY:
  //   - Raw OAuth tokens NEVER stored in Firebase (stay in browser)
  //   - Firebase stores connection metadata only: { email, connectedAt, provider }
  //   - Each member's browser is responsible for refreshing their own token
  //
  // MEMBERKEY OWNERSHIP:
  //   - Connection records keyed by memberKey from FeedActionState.getMyMemberKey()
  //   - One member cannot overwrite another's connection record
  //   - Disconnect removes own record only

  // ── Connection management ──────────────────────────────────────────────
  async function connectGoogleCalendar() {
    if (!hasCalendarScope()) return { ok: false, reason: 'no calendar scope' };
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false, reason: 'no database' };
    var memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    if (!memberKey) return { ok: false, reason: 'no member key' };
    var email = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '';
    try {
      await db.ref(bandPath('google_connections/' + memberKey)).set({
        email: email,
        connectedAt: new Date().toISOString(),
        provider: 'google'
      });
      return { ok: true, memberKey: memberKey };
    } catch(e) { return { ok: false, reason: e.message }; }
  }

  async function disconnectGoogleCalendar() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false };
    var memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    if (!memberKey) return { ok: false };
    try {
      await db.ref(bandPath('google_connections/' + memberKey)).remove();
      await db.ref(bandPath('member_freebusy/' + memberKey)).remove();
      return { ok: true };
    } catch(e) { return { ok: false }; }
  }

  async function getConnectedMembers() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return {};
    try {
      var snap = await db.ref(bandPath('google_connections')).once('value');
      return snap.val() || {};
    } catch(e) { return {}; }
  }

  // ── FREE/BUSY — query + share current user's conflicts ────────────────
  var _freeBusyCache = null;
  var _freeBusyCacheTime = 0;
  var _calendarScopeFailed = false; // sticky: once 403, stop retrying until page reload

  async function getFreeBusy(timeMin, timeMax) {
    if (!hasFreeBusyScope()) return { busy: [], source: 'unavailable' };
    if (_calendarScopeFailed) return { busy: [], source: 'needs_consent' };
    var cacheKey = timeMin + '|' + timeMax;
    if (_freeBusyCache && _freeBusyCacheTime > Date.now() - 300000 && _freeBusyCache._key === cacheKey) {
      return _freeBusyCache;
    }
    try {
      // Use selected calendars (not all — prevents overblocking from birthdays, sports, etc)
      var calIds = await _getSelectedCalendarIds();
      var items = calIds.map(function(id) { return { id: id }; });
      var res = await fetch(WORKER_BASE + '/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify({ timeMin: timeMin, timeMax: timeMax, items: items })
      });
      if (!res.ok) {
        var errBody = '';
        try { errBody = await res.text(); } catch(e) {}
        console.warn('[CalSync] FreeBusy ' + res.status + ' — response:', errBody);
        console.warn('[CalSync] Token (first 20):', accessToken ? accessToken.substring(0, 20) + '...' : 'none');
        if (res.status === 403) {
          _calendarScopeFailed = true;
          return { busy: [], source: 'needs_consent' };
        }
        return { busy: [], source: 'error' };
      }
      // Success — clear any previous failure state
      _calendarScopeFailed = false;
      var data = await res.json();
      var busy = [];
      // Merge busy periods from ALL selected calendars
      if (data.calendars) {
        Object.keys(data.calendars).forEach(function(calId) {
          var cal = data.calendars[calId];
          if (cal.busy) {
            cal.busy.forEach(function(b) { busy.push({ start: b.start, end: b.end }); });
          }
        });
      }
      // Sort chronologically and dedupe overlapping ranges
      busy.sort(function(a, b) { return a.start.localeCompare(b.start); });
      console.log('[CalSync] FreeBusy: queried', calIds.length, 'calendar(s), got', busy.length, 'busy periods');
      _freeBusyCache = { busy: busy, source: 'google', _key: cacheKey };
      _freeBusyCacheTime = Date.now();
      // Share results to Firebase for other band members to read
      _shareFreeBusy(busy, timeMin, timeMax);
      return _freeBusyCache;
    } catch (err) {
      console.warn('[CalSync] Free/busy error:', err);
      return { busy: [], source: 'error' };
    }
  }

  // Write current user's free/busy to shared Firebase path
  async function _shareFreeBusy(busy, timeMin, timeMax) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    if (!memberKey) return;
    try {
      await db.ref(bandPath('member_freebusy/' + memberKey)).set({
        busy: busy,
        timeMin: timeMin,
        timeMax: timeMax,
        updatedAt: new Date().toISOString()
      });
    } catch(e) {}
  }

  // Read ALL members' free/busy from shared Firebase path
  async function getAllMembersFreeBusy() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return {};
    try {
      var snap = await db.ref(bandPath('member_freebusy')).once('value');
      return snap.val() || {};
    } catch(e) { return {}; }
  }

  // Convert free/busy ranges to date-based blocked ranges for calendar
  // Time-aware: classifies events as hard (overlaps event window) or soft (doesn't)
  // opts.rehearsalStartHour / rehearsalEndHour: default window for rehearsal dates
  // opts.dateWindows: { 'YYYY-MM-DD': { startHour, endHour } } — per-date overrides (e.g., gigs)
  function freeBusyToBlockedRanges(busyData, memberName, opts) {
    if (!busyData || !busyData.busy || !busyData.busy.length) return [];
    opts = opts || {};
    var defaultStart = opts.rehearsalStartHour || 17; // 5pm default
    var defaultEnd = opts.rehearsalEndHour || 23; // 11pm default
    var dateWindows = opts.dateWindows || {}; // per-date overrides for gigs
    var ignoreAllDay = opts.ignoreAllDay !== false; // default true
    var timeAware = opts.timeAware !== false; // default true

    var ranges = [];
    var seen = {};

    // Helper: format hour as readable time (e.g., 6pm, 12am)
    function _fmtHour(h) {
      if (h === 0 || h === 24) return '12am';
      if (h === 12) return '12pm';
      return h > 12 ? (h - 12) + 'pm' : h + 'am';
    }

    busyData.busy.forEach(function(b) {
      // Parse into proper Date objects for correct local time
      var startDt = new Date(b.start);
      var endDt = new Date(b.end);

      // Extract LOCAL date and hours (not UTC)
      var startDate = startDt.getFullYear() + '-' + String(startDt.getMonth() + 1).padStart(2, '0') + '-' + String(startDt.getDate()).padStart(2, '0');
      var endDate = endDt.getFullYear() + '-' + String(endDt.getMonth() + 1).padStart(2, '0') + '-' + String(endDt.getDate()).padStart(2, '0');

      // Check if this is an all-day event (date-only format or spans 23h+)
      var isAllDay = b.start.length <= 10 || b.end.length <= 10;
      if (!isAllDay) {
        var durationMs = endDt - startDt;
        if (durationMs >= 23 * 3600000) isAllDay = true;
      }

      // Skip all-day events if user chose to ignore them
      if (ignoreAllDay && isAllDay) return;

      // Time-aware conflict classification using LOCAL hours
      // Use per-date window if available (e.g., gig at 2-5pm), otherwise default rehearsal window
      var windowStart = defaultStart;
      var windowEnd = defaultEnd;
      if (dateWindows[startDate]) {
        windowStart = dateWindows[startDate].startHour;
        windowEnd = dateWindows[startDate].endHour;
      }
      var conflictType = 'hard'; // default: hard conflict
      var timeLabel = '';
      if (timeAware && !isAllDay) {
        var eventStartHour = startDt.getHours();
        var eventEndHour = endDt.getHours();
        var eventEndMin = endDt.getMinutes();
        // Round up end hour if there are remaining minutes
        if (eventEndMin > 0) eventEndHour += 1;
        // Cross-midnight handling: if end hour < start hour, the event wraps past midnight
        // Treat effective end as 24+ for overlap comparison (e.g., 10pm-1am → end=25)
        var effectiveEndHour = eventEndHour;
        if (eventEndHour < eventStartHour || (eventEndHour === 0 && endDate > startDate)) {
          effectiveEndHour = eventEndHour + 24;
        }
        // If event is completely before or after the event window, it's soft
        if (effectiveEndHour <= windowStart || eventStartHour >= windowEnd) {
          conflictType = 'soft';
        }
        // Build readable time label from local hours
        timeLabel = _fmtHour(startDt.getHours()) + '\u2013' + _fmtHour(endDt.getHours());
      }

      // Dedupe by date — keep hardest conflict + update label when upgrading
      var key = startDate + '|' + endDate;
      if (seen[key]) {
        if (conflictType === 'hard' && seen[key]._conflictType !== 'hard') {
          // Upgrade soft → hard: also update the reason/label to the causing event
          seen[key].status = 'unavailable';
          seen[key]._conflictType = 'hard';
          if (timeLabel) {
            seen[key].reason = 'Busy ' + timeLabel + ' (Google)';
            seen[key]._timeLabel = timeLabel;
          }
        }
        return;
      }
      var range = {
        person: memberName || 'You',
        startDate: startDate,
        endDate: endDate,
        reason: timeLabel ? 'Busy ' + timeLabel + ' (Google)' : 'Busy (Google Calendar)',
        status: conflictType === 'hard' ? 'unavailable' : 'tentative',
        _source: 'google',
        _conflictType: conflictType,
        _timeLabel: timeLabel
      };
      seen[key] = range;
      ranges.push(range);
    });
    return ranges;
  }

  // ── ATTENDEE SYNC — read RSVP status from Google event ──────────────────
  async function syncAttendeeStatus(externalEventId) {
    if (!hasCalendarScope() || !externalEventId) return null;
    if (_calendarScopeFailed) return null;
    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId), {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (!res.ok) return null;
      var data = await res.json();
      if (!data.attendees) return null;
      var statuses = {};
      data.attendees.forEach(function(a) {
        if (a.email && a.responseStatus) {
          var map = { accepted: 'yes', declined: 'no', tentative: 'maybe', needsAction: 'pending' };
          statuses[a.email] = { status: map[a.responseStatus] || 'pending', email: a.email, displayName: a.displayName || '' };
        }
      });
      return statuses;
    } catch (err) {
      console.warn('[CalSync] Attendee sync error:', err);
      return null;
    }
  }

  // ── EVENT IMPORT — list Google Calendar events for a date range ──────────
  async function listGoogleEvents(timeMin, timeMax) {
    if (!hasCalendarScope()) return [];
    if (_calendarScopeFailed) return [];
    try {
      var url = WORKER_BASE + '/calendar/events?timeMin=' + encodeURIComponent(timeMin) + '&timeMax=' + encodeURIComponent(timeMax);
      var res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (!res.ok) {
        if (res.status === 403) {
          console.log('[CalSync] Event list 403 — calendar scope not granted (will not retry)');
          _calendarScopeFailed = true;
        }
        return [];
      }
      var data = await res.json();
      if (!data.items) return [];
      return data.items.map(function(ev) {
        var start = ev.start ? (ev.start.dateTime || ev.start.date || '') : '';
        var end = ev.end ? (ev.end.dateTime || ev.end.date || '') : '';
        return {
          id: ev.id,
          title: ev.summary || 'Google Event',
          date: start.substring(0, 10),
          time: start.length > 10 ? start.substring(11, 16) : '',
          endDate: end.substring(0, 10),
          location: ev.location || '',
          type: 'external',
          _source: 'google',
          _htmlLink: ev.htmlLink || ''
        };
      });
    } catch (err) {
      console.warn('[CalSync] List events error:', err);
      return [];
    }
  }

  // ── CONFLICT SYNC — push GrooveLinx conflicts to Google Calendar ─────────
  //
  // Creates a private "Busy" event in the user's Google Calendar.
  // Never auto-syncs — only triggered by explicit user action.

  async function syncConflictToGoogle(block) {
    if (!hasCalendarScope() || !block) return { success: false, error: 'no scope' };
    var startDate = block.startDate;
    var endDate = block.endDate;
    if (!startDate || !endDate) return { success: false, error: 'no dates' };
    // All-day event: use date (not dateTime), end is exclusive in Google API
    var endExclusive = new Date(endDate + 'T00:00:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    var endStr = endExclusive.getFullYear() + '-' + String(endExclusive.getMonth() + 1).padStart(2, '0') + '-' + String(endExclusive.getDate()).padStart(2, '0');

    var body = {
      summary: 'Busy',
      description: 'Created by GrooveLinx (band scheduling)',
      start: { date: startDate },
      end: { date: endStr },
      visibility: 'private',
      transparency: 'opaque',
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: { groovelinxConflictId: block.blockId || '' } }
    };

    try {
      // Check for existing event to prevent duplicates
      if (block.googleEventId) {
        return await updateConflictInGoogle(block);
      }
      var res = await fetch(WORKER_BASE + '/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        console.warn('[CalSync] Conflict sync failed:', res.status);
        return { success: false, error: 'Google returned ' + res.status };
      }
      var data = await res.json();
      return { success: true, googleEventId: data.id, htmlLink: data.htmlLink || '' };
    } catch (err) {
      console.warn('[CalSync] Conflict sync error:', err);
      return { success: false, error: err.message };
    }
  }

  async function updateConflictInGoogle(block) {
    if (!hasCalendarScope() || !block || !block.googleEventId) return { success: false };
    var endExclusive = new Date(block.endDate + 'T00:00:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    var endStr = endExclusive.getFullYear() + '-' + String(endExclusive.getMonth() + 1).padStart(2, '0') + '-' + String(endExclusive.getDate()).padStart(2, '0');

    var body = {
      summary: 'Busy',
      description: 'Created by GrooveLinx (band scheduling)',
      start: { date: block.startDate },
      end: { date: endStr },
      visibility: 'private',
      transparency: 'opaque'
    };
    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(block.googleEventId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify(body)
      });
      if (!res.ok) return { success: false, error: 'Update failed: ' + res.status };
      return { success: true, googleEventId: block.googleEventId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function deleteConflictFromGoogle(googleEventId) {
    if (!hasCalendarScope() || !googleEventId) return { success: false };
    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(googleEventId), {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.status === 204 || res.status === 410) return { success: true };
      return { success: false, error: 'Delete failed: ' + res.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Reset scope failure flag (call after successful re-consent) ──────────
  function resetScopeFailure() {
    _calendarScopeFailed = false;
    _freeBusyCache = null;
    _freeBusyCacheTime = 0;
  }

  // ── CALENDAR SELECTION & AVAILABILITY RULES ────────────────────────────────
  // Lets users choose WHICH calendars affect their availability and HOW.
  // Settings stored per-member in Firebase: bands/{slug}/cal_settings/{memberKey}

  // Patterns that indicate auto-excludable calendars
  var _AUTO_EXCLUDE_PATTERNS = [
    /birthday/i, /holiday/i, /contacts/i,
    /#contacts@group\.v1\.calendar\.google\.com$/i,
    /^addressbook#contacts@group\.v1\.calendar\.google\.com$/i
  ];

  // Fetch user's calendar list from Google
  async function listCalendars() {
    if (!hasCalendarScope()) return [];
    if (_calendarScopeFailed) return [];
    try {
      var res = await fetch(WORKER_BASE + '/calendar/list', {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (!res.ok) return [];
      var data = await res.json();
      if (!data.items) return [];
      return data.items.map(function(c) {
        var isAutoExclude = _AUTO_EXCLUDE_PATTERNS.some(function(p) { return p.test(c.summary || '') || p.test(c.id || ''); });
        return {
          id: c.id,
          summary: c.summary || c.id,
          primary: !!c.primary,
          backgroundColor: c.backgroundColor || '',
          accessRole: c.accessRole || '',
          autoExclude: isAutoExclude
        };
      });
    } catch(e) {
      console.warn('[CalSync] listCalendars error:', e);
      return [];
    }
  }

  // Get saved availability settings from Firebase
  async function getAvailabilitySettings() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return null;
    var memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    if (!memberKey) return null;
    try {
      var snap = await db.ref(bandPath('cal_settings/' + memberKey)).once('value');
      return snap.val();
    } catch(e) { return null; }
  }

  // Save availability settings to Firebase
  async function saveAvailabilitySettings(settings) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    var memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    if (!memberKey) return false;
    try {
      await db.ref(bandPath('cal_settings/' + memberKey)).set(settings);
      // Invalidate cache so next query uses new settings
      _freeBusyCache = null;
      _freeBusyCacheTime = 0;
      return true;
    } catch(e) { return false; }
  }

  // Get the effective calendar IDs to query for AVAILABILITY (read-only)
  async function _getSelectedCalendarIds() {
    var settings = await getAvailabilitySettings();
    if (settings && settings.selectedCalendars && settings.selectedCalendars.length > 0) {
      return settings.selectedCalendars;
    }
    return ['primary'];
  }

  // Get the band calendar ID for WRITES (rehearsals, gigs)
  // Checks band-level setting first (shared), then user-level fallback
  async function _getBandCalendarId() {
    // Band-level setting (shared across all members)
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('band_calendar/calendarId')).once('value');
        if (snap.val()) return snap.val();
      }
    } catch(e) {}
    // User-level fallback
    var settings = await getAvailabilitySettings();
    if (settings && settings.bandCalendarId) return settings.bandCalendarId;
    return 'primary';
  }

  // Get the default rehearsal window (user-configurable)
  async function _getRehearsalWindow() {
    var settings = await getAvailabilitySettings();
    if (settings && settings.rehearsalWindow) return settings.rehearsalWindow;
    // Default: 5pm-11pm (covers most band rehearsal times)
    return { startHour: 17, endHour: 23 };
  }

  // Check if settings indicate all-day events should be ignored
  async function _shouldIgnoreAllDay() {
    var settings = await getAvailabilitySettings();
    if (settings && typeof settings.ignoreAllDay !== 'undefined') return settings.ignoreAllDay;
    return false; // Default: DO NOT ignore — a false "free" is worse than birthday noise
  }

  // Check if time-aware filtering is enabled
  async function _isTimeAwareEnabled() {
    var settings = await getAvailabilitySettings();
    if (settings && typeof settings.timeAware !== 'undefined') return settings.timeAware;
    return true; // Default: enabled
  }

  // Check if current user can write to the band calendar
  var _bandCalAccessCache = null;
  async function canWriteBandCalendar() {
    if (_bandCalAccessCache !== null) return _bandCalAccessCache;
    var calId = await _getBandCalendarId();
    if (calId === 'primary') { _bandCalAccessCache = true; return true; }
    // Check if user's calendar list includes the band calendar
    try {
      var cals = await listCalendars();
      _bandCalAccessCache = cals.some(function(c) { return c.id === calId; });
    } catch(e) { _bandCalAccessCache = false; }
    return _bandCalAccessCache;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    create: create,
    update: update,
    remove: remove,
    hasCalendarScope: hasCalendarScope,
    saveSyncState: saveSyncState,
    getSyncStatus: getSyncStatus,
    renderSyncBadge: renderSyncBadge,
    // Phase 2: Real-world awareness
    getFreeBusy: getFreeBusy,
    freeBusyToBlockedRanges: freeBusyToBlockedRanges,
    syncAttendeeStatus: syncAttendeeStatus,
    listGoogleEvents: listGoogleEvents,
    // Phase 3: Multi-user band sync
    connectGoogleCalendar: connectGoogleCalendar,
    disconnectGoogleCalendar: disconnectGoogleCalendar,
    getConnectedMembers: getConnectedMembers,
    getAllMembersFreeBusy: getAllMembersFreeBusy,
    resetScopeFailure: resetScopeFailure,
    // Conflict sync (GrooveLinx → Google)
    syncConflictToGoogle: syncConflictToGoogle,
    updateConflictInGoogle: updateConflictInGoogle,
    deleteConflictFromGoogle: deleteConflictFromGoogle,
    // Calendar selection & availability rules
    listCalendars: listCalendars,
    getAvailabilitySettings: getAvailabilitySettings,
    saveAvailabilitySettings: saveAvailabilitySettings,
    hasFreeBusyScope: hasFreeBusyScope,
    getBandCalendarId: _getBandCalendarId,
    canWriteBandCalendar: canWriteBandCalendar,
    _getBandEmails: _getBandEmails,
    _buildEventBody: _buildEventBody
  };

})();

console.log('\u2705 gl-calendar-sync.js loaded');
