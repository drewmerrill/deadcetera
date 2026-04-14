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
  // Priority: 1) OAuth callback flag  2) persisted localStorage  3) config fallback
  function hasCalendarScope() {
    if (typeof accessToken === 'undefined' || !accessToken) return false;
    // Source 1: live OAuth callback flag (set during this session's token grant)
    if (typeof window._calendarScopeGranted !== 'undefined') return window._calendarScopeGranted;
    // Source 2: persisted granted state from a previous OAuth session
    try {
      var _persisted = localStorage.getItem('gl_scope_calendar');
      if (_persisted !== null) return _persisted === '1';
    } catch(e) {}
    // Source 3: config fallback (we requested calendar scope, assume granted)
    return typeof GOOGLE_DRIVE_CONFIG !== 'undefined' &&
      GOOGLE_DRIVE_CONFIG.scope && GOOGLE_DRIVE_CONFIG.scope.indexOf('calendar') !== -1;
  }

  // FreeBusy requires full calendar or calendar.freebusy scope (calendar.events is NOT enough)
  // Priority: 1) OAuth callback flag  2) persisted localStorage  3) config fallback
  function hasFreeBusyScope() {
    if (typeof accessToken === 'undefined' || !accessToken) {
      console.log('[CalSync] hasFreeBusyScope: false (no accessToken)');
      return false;
    }
    // Source 1: live OAuth callback flag
    if (typeof window._calendarFreeBusyGranted !== 'undefined') {
      console.log('[CalSync] hasFreeBusyScope:', window._calendarFreeBusyGranted, '(OAuth callback flag)');
      return window._calendarFreeBusyGranted;
    }
    // Source 2: persisted granted state from a previous OAuth
    try {
      var _persisted = localStorage.getItem('gl_scope_freeBusy');
      if (_persisted !== null) {
        var _val = _persisted === '1';
        console.log('[CalSync] hasFreeBusyScope:', _val, '(persisted localStorage)');
        return _val;
      }
    } catch(e) {}
    // Source 3: config fallback — full calendar scope includes freeBusy
    if (typeof GOOGLE_DRIVE_CONFIG !== 'undefined' && GOOGLE_DRIVE_CONFIG.scope) {
      var _hasFullCalScope = GOOGLE_DRIVE_CONFIG.scope.indexOf('/auth/calendar') !== -1
        && GOOGLE_DRIVE_CONFIG.scope.indexOf('calendar.events') === -1;
      if (_hasFullCalScope) {
        console.log('[CalSync] hasFreeBusyScope: true (config fallback — full calendar scope requested)');
        return true;
      }
    }
    console.log('[CalSync] hasFreeBusyScope: false (no source matched)');
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

    // Tag as GrooveLinx-created for deterministic circular-conflict suppression
    // Google extended properties are string-only key/value pairs
    body.extendedProperties = {
      private: {
        groovelinx: 'true',
        glEventId: opts.glEventId || ''
      }
    };

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

    var _opts = Object.assign({}, opts, { glEventId: glEvent.id || glEvent.eventId || '' });
    var body = _buildEventBody(glEvent, _opts);
    var calId = await _getBandCalendarId();
    if (!calId) return { success: false, error: 'No band calendar configured. Open Rules to set one up.' };

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

    var _opts = Object.assign({}, opts, { glEventId: glEvent.id || glEvent.eventId || '' });
    var body = _buildEventBody(glEvent, _opts);
    var calId = await _getBandCalendarId();
    if (!calId) return { success: false, error: 'No band calendar configured.' };

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
    if (!calId) return { success: false, error: 'No band calendar configured.' };

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

  // ── BAND EVENT IDENTIFICATION — deterministic circular-conflict suppression ──

  // Load known Google event IDs from Firebase calendar_events
  async function _loadKnownGoogleEventIds() {
    var ids = {};
    try {
      var events = [];
      if (typeof loadBandDataFromDrive === 'function') {
        events = (typeof toArray === 'function') ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []) : [];
      }
      events.forEach(function(ev) {
        var gId = (ev.sync && ev.sync.externalEventId) || ev.googleEventId || null;
        if (gId) ids[gId] = true;
      });
    } catch(e) {}
    return ids;
  }

  // Query Google events across selected calendars, identify which are GrooveLinx-created.
  // Returns array of { start: ISO, end: ISO, matchType: 'extProp'|'eventId' }
  async function _getBandEventTimeSlots(calIds, timeMin, timeMax) {
    var slots = [];
    try {
      var knownIds = await _loadKnownGoogleEventIds();
      // Query each selected calendar for events in the time range
      var fetches = calIds.map(function(calId) {
        var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(calId)
          + '&timeMin=' + encodeURIComponent(timeMin)
          + '&timeMax=' + encodeURIComponent(timeMax);
        return fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } })
          .then(function(r) { return r.ok ? r.json() : { items: [] }; })
          .catch(function() { return { items: [] }; });
      });
      var responses = await Promise.all(fetches);
      responses.forEach(function(data) {
        if (!data.items) return;
        data.items.forEach(function(ev) {
          // Primary match: extendedProperties.private.groovelinx === 'true'
          var extProp = ev.extendedProperties && ev.extendedProperties.private;
          var isTagged = extProp && extProp.groovelinx === 'true';
          // Secondary match: Google event ID is in our known Firebase set
          var isKnownId = knownIds[ev.id] === true;

          if (isTagged || isKnownId) {
            var start = (ev.start && (ev.start.dateTime || ev.start.date)) || '';
            var end = (ev.end && (ev.end.dateTime || ev.end.date)) || '';
            slots.push({
              start: start,
              end: end,
              googleEventId: ev.id,
              glEventId: (extProp && extProp.glEventId) || '',
              matchType: isTagged ? 'extProp' : 'eventId'
            });
          }
        });
      });
      if (slots.length) console.log('[CalSync] Band event slots identified:', slots.length, '(' + slots.filter(function(s){return s.matchType==='extProp';}).length + ' by extProp, ' + slots.filter(function(s){return s.matchType==='eventId';}).length + ' by eventId)');
    } catch(e) {
      console.warn('[CalSync] getBandEventTimeSlots error:', e);
    }
    return slots;
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

      // Run free/busy + band-event identification in PARALLEL
      var fbPromise = fetch(WORKER_BASE + '/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify({ timeMin: timeMin, timeMax: timeMax, items: items })
      });
      var bandSlotsPromise = _getBandEventTimeSlots(calIds, timeMin, timeMax);
      var results = await Promise.all([fbPromise, bandSlotsPromise]);
      var res = results[0];
      var bandSlots = results[1];

      if (!res.ok) {
        var errBody = '';
        try { errBody = await res.text(); } catch(e) {}
        console.warn('[CalSync] FreeBusy ' + res.status + ' — response:', errBody);
        console.warn('[CalSync] Token (first 20):', accessToken ? accessToken.substring(0, 20) + '...' : 'none');
        if (res.status === 403) {
          _calendarScopeFailed = true;
          return { busy: [], bandSlots: [], source: 'needs_consent' };
        }
        return { busy: [], bandSlots: [], source: 'error' };
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
      // Debug logging: availability reasoning
      console.log('[CalSync] FreeBusy: queried', calIds.length, 'calendar(s):', calIds.join(', '));
      console.log('[CalSync] FreeBusy: got', busy.length, 'busy periods, bandSlots:', bandSlots.length);
      if (busy.length > 0) {
        busy.slice(0, 5).forEach(function(b) {
          console.log('[CalSync]   busy:', b.start, '→', b.end);
        });
        if (busy.length > 5) console.log('[CalSync]   ... and', busy.length - 5, 'more');
      }
      _freeBusyCache = { busy: busy, bandSlots: bandSlots, source: 'google', _key: cacheKey };
      _freeBusyCacheTime = Date.now();
      // Share results to Firebase for other band members to read
      _shareFreeBusy(busy, timeMin, timeMax);
      return _freeBusyCache;
    } catch (err) {
      console.warn('[CalSync] Free/busy error:', err);
      return { busy: [], bandSlots: [], source: 'error' };
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
        reason: isAllDay ? 'Busy all day (Personal Calendar)' : (timeLabel ? 'Busy ' + timeLabel + ' (Personal Calendar)' : 'Busy (Personal Calendar)'),
        status: conflictType === 'hard' ? 'unavailable' : 'tentative',
        _source: 'google',
        _conflictType: conflictType,
        _timeLabel: timeLabel,
        _isAllDay: isAllDay,
        _isoStart: b.start,  // raw ISO for deterministic conflict matching
        _isoEnd: b.end
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

  // ── TWO-WAY SYNC ENGINE (Mode A: Shared Calendar) ──────────────────────
  // Full bidirectional sync using Google Calendar's incremental syncToken.
  // Phase 1: Push local changes to Google
  // Phase 2: Pull remote changes from Google (incremental or full)
  // Phase 3: Propagate local deletions to Google

  async function _loadSyncState() {
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('calendar_sync_state')).once('value');
        return snap.val() || {};
      }
    } catch(e) {}
    return {};
  }

  async function _saveSyncState(state) {
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        await db.ref(bandPath('calendar_sync_state')).set(state);
      }
    } catch(e) { console.warn('[CalSync] Failed to save sync state:', e); }
  }

  // Merge a Google event into an existing GrooveLinx event (preserving GL metadata)
  function _reconcileEvent(existing, googleEvent) {
    var isAllDay = !!(googleEvent.start && googleEvent.start.date && !googleEvent.start.dateTime);
    var startStr = googleEvent.start ? (googleEvent.start.dateTime || googleEvent.start.date || '') : '';
    var endStr = googleEvent.end ? (googleEvent.end.dateTime || googleEvent.end.date || '') : '';
    // Update scheduling fields from Google (source of truth for dates/times)
    existing.date = startStr.substring(0, 10);
    existing.title = googleEvent.summary || existing.title;
    existing.location = googleEvent.location || existing.location;
    existing.notes = googleEvent.description || existing.notes;
    existing.isAllDay = isAllDay;
    if (!isAllDay && startStr.length > 10) {
      existing.time = startStr.substring(11, 16);
      if (endStr.length > 10) existing.endTime = endStr.substring(11, 16);
    } else {
      existing.time = '';
      existing.endTime = '';
    }
    existing.updated_at = new Date().toISOString();
    existing.sync = existing.sync || {};
    existing.sync.lastSyncedAt = new Date().toISOString();
    existing.sync.status = 'synced';
    // Preserve GrooveLinx-only metadata: type, venueId, linkedSetlist, availability,
    // assignedMembers, gigId, blockScope, _importedFromGoogle — these are NEVER overwritten
    return existing;
  }

  // Build a new GrooveLinx event from a Google event (for first-time imports)
  function _importGoogleEvent(googleEvent, bandCalId) {
    var isAllDay = !!(googleEvent.start && googleEvent.start.date && !googleEvent.start.dateTime);
    var startStr = googleEvent.start ? (googleEvent.start.dateTime || googleEvent.start.date || '') : '';
    var endStr = googleEvent.end ? (googleEvent.end.dateTime || googleEvent.end.date || '') : '';
    var summary = googleEvent.summary || 'Google Event';
    var lc = summary.toLowerCase();
    var inferredType = 'other';
    if (lc.indexOf('rehearsal') !== -1 || lc.indexOf('practice') !== -1) inferredType = 'rehearsal';
    else if (lc.indexOf('gig') !== -1 || lc.indexOf('show') !== -1 || lc.indexOf('concert') !== -1) inferredType = 'gig';
    else if (lc.indexOf('meeting') !== -1) inferredType = 'meeting';
    var eventTime = (!isAllDay && startStr.length > 10) ? startStr.substring(11, 16) : '';
    var eventEndTime = (!isAllDay && endStr.length > 10) ? endStr.substring(11, 16) : '';

    return {
      id: (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: startStr.substring(0, 10),
      type: inferredType,
      title: summary,
      time: eventTime,
      endTime: eventEndTime,
      location: googleEvent.location || '',
      notes: googleEvent.description || '',
      venue: (inferredType === 'gig') ? summary : '',
      isAllDay: isAllDay,
      _importedFromGoogle: true,
      googleEventId: googleEvent.id,
      calendarId: bandCalId,
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      sync: { provider: 'google', externalEventId: googleEvent.id, calendarId: bandCalId, status: 'synced', direction: 'inbound', lastSyncedAt: new Date().toISOString() },
      created: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async function syncBandCalendar() {
    if (!hasCalendarScope()) return { error: 'no scope', pushed: 0, pulled: 0, deleted: 0 };
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) return { error: 'no band calendar configured', pushed: 0, pulled: 0, deleted: 0 };

    console.log('[CalSync] === TWO-WAY SYNC START ===');
    var syncState = await _loadSyncState();
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var result = { pushed: 0, pulled: 0, updated: 0, deleted: 0, error: null };

    // ── PHASE 1: Push local unsynced events to Google ──
    console.log('[CalSync] Phase 1: Push local changes...');
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var alreadySynced = (ev.syncStatus === 'synced' && ev.googleEventId)
        || (ev.sync && ev.sync.externalEventId && ev.sync.status === 'synced');
      if (alreadySynced || !ev.date || !ev.title) continue;
      try {
        var glEvent = {
          id: ev.id || '', eventId: ev.id || '',
          summary: ev.title, date: ev.date, startTime: ev.time || '19:00',
          location: ev.location || ev.venue || '', description: ev.notes || '', type: ev.type
        };
        var sync = await create(glEvent);
        if (sync.success && sync.sync) {
          events[i].googleEventId = sync.sync.externalEventId;
          events[i].calendarId = sync.sync.calendarId;
          events[i].syncStatus = 'synced';
          events[i].lastSyncedAt = new Date().toISOString();
          events[i].sync = sync.sync;
          result.pushed++;
        }
      } catch(e) { console.warn('[CalSync] Push failed for', ev.title, e.message); }
    }
    if (result.pushed > 0) {
      await saveBandDataToDrive('_band', 'calendar_events', events);
      console.log('[CalSync] Phase 1: Pushed', result.pushed, 'events');
    }

    // ── PHASE 2: Pull remote changes from Google (incremental or full) ──
    console.log('[CalSync] Phase 2: Pull remote changes...');
    var knownGoogleIds = {};
    var eventsByGoogleId = {};
    events.forEach(function(e, idx) {
      if (e.googleEventId) { knownGoogleIds[e.googleEventId] = true; eventsByGoogleId[e.googleEventId] = idx; }
      if (e.sync && e.sync.externalEventId) { knownGoogleIds[e.sync.externalEventId] = true; eventsByGoogleId[e.sync.externalEventId] = idx; }
    });

    var googleEvents = [];
    var pageToken = null;
    var useSyncToken = !!syncState.syncToken;
    var newSyncToken = null;
    try {
      do {
        var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId)
          + '&maxResults=250&showDeleted=true';
        if (useSyncToken && syncState.syncToken && !pageToken) {
          url += '&syncToken=' + encodeURIComponent(syncState.syncToken);
        } else if (!useSyncToken) {
          // Full sync: query 12 months centered on now
          var now = new Date();
          var min = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
          var max = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59).toISOString();
          url += '&timeMin=' + encodeURIComponent(min) + '&timeMax=' + encodeURIComponent(max);
        }
        if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);

        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (res.status === 410) {
          // syncToken expired — fall back to full sync
          console.log('[CalSync] syncToken expired (410) — full re-sync');
          syncState.syncToken = null;
          useSyncToken = false;
          continue; // restart the do-while with full query
        }
        if (!res.ok) {
          console.warn('[CalSync] Pull failed:', res.status);
          result.error = 'Google API ' + res.status;
          break;
        }
        var data = await res.json();
        googleEvents = googleEvents.concat(data.items || []);
        pageToken = data.nextPageToken || null;
        if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
      } while (pageToken);
    } catch(e) {
      console.warn('[CalSync] Pull error:', e);
      result.error = e.message;
    }

    console.log('[CalSync] Phase 2: Fetched', googleEvents.length, 'changes', useSyncToken ? '(incremental)' : '(full)');

    var dirty = false;
    googleEvents.forEach(function(gEv) {
      if (!gEv.id) return;
      var existIdx = eventsByGoogleId[gEv.id];

      if (gEv.status === 'cancelled') {
        // ── Deletion from Google → remove from Firebase ──
        if (existIdx !== undefined && existIdx >= 0) {
          console.log('[CalSync] Inbound DELETE:', events[existIdx].title, events[existIdx].date);
          events.splice(existIdx, 1);
          // Rebuild index after splice
          eventsByGoogleId = {};
          events.forEach(function(e, idx) {
            if (e.googleEventId) eventsByGoogleId[e.googleEventId] = idx;
            if (e.sync && e.sync.externalEventId) eventsByGoogleId[e.sync.externalEventId] = idx;
          });
          result.deleted++;
          dirty = true;
        }
        return;
      }

      if (existIdx !== undefined && existIdx >= 0) {
        // ── Update: Google event matches existing Firebase event ──
        _reconcileEvent(events[existIdx], gEv);
        result.updated++;
        dirty = true;
      } else {
        // ── New: import from Google ──
        var newEv = _importGoogleEvent(gEv, bandCalId);
        events.push(newEv);
        eventsByGoogleId[gEv.id] = events.length - 1;
        result.pulled++;
        dirty = true;
        console.log('[CalSync] Inbound NEW:', newEv.title, newEv.date);
      }
    });

    // ── PHASE 3: Propagate local deletions to Google ──
    var deletedLocally = events.filter(function(e) { return e.sync && e.sync.status === 'deleted_locally'; });
    for (var di = 0; di < deletedLocally.length; di++) {
      var del = deletedLocally[di];
      if (del.googleEventId) {
        try {
          await remove(del.googleEventId);
          events = events.filter(function(e) { return e !== del; });
          result.deleted++;
          dirty = true;
          console.log('[CalSync] Outbound DELETE:', del.title);
        } catch(e) { console.warn('[CalSync] Delete failed:', del.title, e.message); }
      }
    }

    // Save all changes
    if (dirty) {
      await saveBandDataToDrive('_band', 'calendar_events', events);
    }

    // Save sync token for next incremental sync
    if (newSyncToken) {
      await _saveSyncState({
        syncToken: newSyncToken,
        lastFullSync: useSyncToken ? (syncState.lastFullSync || null) : new Date().toISOString(),
        lastIncrementalSync: new Date().toISOString(),
        syncVersion: 2
      });
      console.log('[CalSync] Sync token saved for next incremental sync');
    }

    console.log('[CalSync] === TWO-WAY SYNC COMPLETE: pushed', result.pushed, '| pulled', result.pulled, '| updated', result.updated, '| deleted', result.deleted, '===');
    return result;
  }

  // ── INBOUND SYNC (legacy — kept as fallback for Mode C) ────────────────
  // Fetches ALL events from the selected band Google Calendar (with pagination).
  // Imports events not already in GrooveLinx. Does NOT require extendedProperties.
  // Handles all-day events, multi-day spans, and timed events.
  async function pullBandCalendarEvents(timeMin, timeMax) {
    if (!hasCalendarScope()) return { imported: 0, skipped: 0, fetched: 0, events: [], error: 'no scope' };
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) return { imported: 0, skipped: 0, fetched: 0, events: [], error: 'no band calendar configured' };

    console.log('[CalSync] Inbound sync: fetching from band calendar', bandCalId, timeMin, '\u2192', timeMax);
    try {
      // ── Paginated fetch — get ALL events, not just first 250 ──
      var googleEvents = [];
      var pageToken = null;
      var pageNum = 0;
      do {
        pageNum++;
        var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId)
          + '&timeMin=' + encodeURIComponent(timeMin)
          + '&timeMax=' + encodeURIComponent(timeMax)
          + '&maxResults=250';
        if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (!res.ok) {
          console.warn('[CalSync] Inbound sync page', pageNum, 'failed:', res.status);
          return { imported: 0, skipped: 0, fetched: googleEvents.length, events: [], error: 'Google API ' + res.status };
        }
        var data = await res.json();
        var pageItems = data.items || [];
        googleEvents = googleEvents.concat(pageItems);
        pageToken = data.nextPageToken || null;
        console.log('[CalSync] Inbound page', pageNum + ':', pageItems.length, 'events' + (pageToken ? ' (more pages)' : ' (last page)'));
      } while (pageToken);
      console.log('[CalSync] Inbound sync: fetched', googleEvents.length, 'total events from band calendar');

      // ── Load existing GrooveLinx events for dedup ──
      var existingEvents = [];
      if (typeof loadBandDataFromDrive === 'function') {
        existingEvents = (typeof toArray === 'function')
          ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
          : [];
      }
      var knownGoogleIds = {};
      existingEvents.forEach(function(e) {
        if (e.googleEventId) knownGoogleIds[e.googleEventId] = true;
        if (e.sync && e.sync.externalEventId) knownGoogleIds[e.sync.externalEventId] = true;
      });

      var imported = [];
      var skipped = [];
      var _upgraded = 0; // existing events upgraded to 'unavailable'
      var _genId = function() {
        return (typeof generateShortId === 'function') ? generateShortId(12)
          : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      };

      // Build member name lookup for unavailability detection
      var _memberNames = {}; // { 'drew': 'drew_key', 'brian': 'brian_key', ... }
      var _allMemberKeys = [];
      var _bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
      Object.keys(_bm).forEach(function(k) {
        var name = _bm[k] && _bm[k].name ? _bm[k].name : '';
        if (name) {
          _memberNames[name.split(' ')[0].toLowerCase()] = k; // first name → key
          _memberNames[name.toLowerCase()] = k; // full name → key
        }
        _allMemberKeys.push(k);
      });

      // Unavailability keyword sets
      var _strongUnavailKw = ['out', 'unavailable', 'pto', 'vacation', 'away', 'travel'];
      var _weakUnavailKw = ['busy', 'conflict', 'off', 'blocked']; // only valid with member name or band phrase
      var _wholeBandPhrases = ['band off', 'full band off', 'everyone out', 'no rehearsal', 'band unavailable', 'all out', 'band away'];

      function _detectUnavailability(title) {
        var lc = title.toLowerCase().trim();
        // Check whole-band phrases first
        for (var wp = 0; wp < _wholeBandPhrases.length; wp++) {
          if (lc.indexOf(_wholeBandPhrases[wp]) !== -1) {
            return { isUnavail: true, scope: 'band', members: _allMemberKeys.slice() };
          }
        }
        // Check strong keywords (standalone match)
        var hasStrongKw = _strongUnavailKw.some(function(kw) {
          // Match as whole word or with separators (not substring of another word)
          var idx = lc.indexOf(kw);
          if (idx === -1) return false;
          var before = idx > 0 ? lc[idx - 1] : ' ';
          var after = idx + kw.length < lc.length ? lc[idx + kw.length] : ' ';
          return /[\s\-–—,.:;!?/]/.test(before) || idx === 0 ? (/[\s\-–—,.:;!?/]/.test(after) || idx + kw.length === lc.length) : false;
        });
        // Check weak keywords (need member name to qualify)
        var hasWeakKw = !hasStrongKw && _weakUnavailKw.some(function(kw) {
          return lc.indexOf(kw) !== -1;
        });
        if (!hasStrongKw && !hasWeakKw) return { isUnavail: false };
        // Extract member name(s) from title
        var matchedMembers = [];
        Object.keys(_memberNames).forEach(function(name) {
          if (name.length < 2) return; // skip single letters
          if (lc.indexOf(name) !== -1) {
            var key = _memberNames[name];
            if (matchedMembers.indexOf(key) === -1) matchedMembers.push(key);
          }
        });
        // Also check for "&" or "and" patterns: "Drew & Jay - Out"
        // (member extraction above already handles multiple names in the string)
        if (hasStrongKw && matchedMembers.length > 0) {
          return { isUnavail: true, scope: 'member', members: matchedMembers };
        }
        if (hasWeakKw && matchedMembers.length > 0) {
          return { isUnavail: true, scope: 'member', members: matchedMembers };
        }
        if (hasStrongKw && matchedMembers.length === 0) {
          // Strong keyword but no member name — ambiguous, don't auto-block
          return { isUnavail: true, scope: 'unassigned', members: [] };
        }
        return { isUnavail: false };
      }

      googleEvents.forEach(function(gEv) {
        if (gEv.status === 'cancelled') { skipped.push({ id: gEv.id, reason: 'cancelled' }); return; }
        if (knownGoogleIds[gEv.id]) {
          // Already imported — but check if we should upgrade its type to 'unavailable'
          // (handles events imported before unavailability detection was added)
          var _existIdx = existingEvents.findIndex(function(e) {
            return e.googleEventId === gEv.id || (e.sync && e.sync.externalEventId === gEv.id);
          });
          if (_existIdx >= 0 && existingEvents[_existIdx].type !== 'unavailable' && existingEvents[_existIdx].type !== 'rehearsal' && existingEvents[_existIdx].type !== 'gig') {
            var _recheck = (existingEvents[_existIdx].type !== 'rehearsal' && existingEvents[_existIdx].type !== 'gig') ? _detectUnavailability(gEv.summary || '') : { isUnavail: false };
            if (_recheck.isUnavail && _recheck.scope !== 'unassigned') {
              existingEvents[_existIdx].type = 'unavailable';
              existingEvents[_existIdx].assignedMembers = _recheck.members;
              existingEvents[_existIdx].blockScope = _recheck.scope;
              _upgraded++;
              console.log('[CalSync] Inbound: UPGRADED existing "' + (gEv.summary || '') + '" to unavailable → blocking', _recheck.members.map(function(k) { return _bm[k] ? _bm[k].name.split(' ')[0] : k; }).join(', '));
            }
          }
          skipped.push({ id: gEv.id, title: gEv.summary, reason: 'already exists' }); return;
        }

        var isAllDay = !!(gEv.start && gEv.start.date && !gEv.start.dateTime);
        var startStr = gEv.start ? (gEv.start.dateTime || gEv.start.date || '') : '';
        var endStr = gEv.end ? (gEv.end.dateTime || gEv.end.date || '') : '';
        var startDate = startStr.substring(0, 10);
        var summary = gEv.summary || 'Google Event';

        // Infer type from summary
        var inferredType = 'other';
        var lc = summary.toLowerCase();
        if (lc.indexOf('rehearsal') !== -1 || lc.indexOf('practice') !== -1) inferredType = 'rehearsal';
        else if (lc.indexOf('gig') !== -1 || lc.indexOf('show') !== -1 || lc.indexOf('concert') !== -1) inferredType = 'gig';
        else if (lc.indexOf('meeting') !== -1) inferredType = 'meeting';

        // ── Unavailability detection ──
        var _unavail = (inferredType !== 'rehearsal' && inferredType !== 'gig') ? _detectUnavailability(summary) : { isUnavail: false };
        if (_unavail.isUnavail) {
          inferredType = _unavail.scope === 'unassigned' ? 'unavailable_unassigned' : 'unavailable';
          if (_unavail.scope === 'member') {
            var _mNames = _unavail.members.map(function(k) { return _bm[k] ? _bm[k].name.split(' ')[0] : k; });
            console.log('[CalSync] Inbound: MEMBER UNAVAILABLE "' + summary + '" \u2192 blocking', _mNames.join(', '));
          } else if (_unavail.scope === 'band') {
            console.log('[CalSync] Inbound: WHOLE BAND UNAVAILABLE "' + summary + '"');
          } else {
            console.log('[CalSync] Inbound: AMBIGUOUS UNAVAILABLE "' + summary + '" \u2192 imported but NOT blocking (no member identified)');
          }
        }

        // ── Multi-day all-day events: expand to one record per day ──
        if (isAllDay) {
          var endDate = endStr.substring(0, 10);
          // Google all-day end dates are exclusive (Jun 26 means through Jun 25)
          var _start = new Date(startDate + 'T12:00:00');
          var _end = new Date(endDate + 'T12:00:00');
          var dayCount = Math.round((_end - _start) / 86400000);
          if (dayCount < 1) dayCount = 1;

          if (dayCount > 1) {
            console.log('[CalSync] Inbound: expanding multi-day event "' + summary + '" across', dayCount, 'days (' + startDate + ' \u2192 ' + endDate + ')');
          }

          for (var di = 0; di < dayCount; di++) {
            var _d = new Date(_start.getTime() + di * 86400000);
            var _ds = _d.getFullYear() + '-' + String(_d.getMonth() + 1).padStart(2, '0') + '-' + String(_d.getDate()).padStart(2, '0');
            var _rec = {
              id: _genId(),
              date: _ds,
              type: inferredType,
              title: summary + (dayCount > 1 ? ' (day ' + (di + 1) + '/' + dayCount + ')' : ''),
              time: '',
              endTime: '',
              location: gEv.location || '',
              notes: gEv.description || '',
              isAllDay: true,
              _importedFromGoogle: true,
              _googleSource: summary,
              googleEventId: gEv.id,
              calendarId: bandCalId,
              syncStatus: 'synced',
              lastSyncedAt: new Date().toISOString(),
              sync: { provider: 'google', externalEventId: gEv.id, calendarId: bandCalId, status: 'synced', direction: 'inbound', lastSyncedAt: new Date().toISOString() },
              created: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            if (_unavail.isUnavail) {
              _rec.assignedMembers = _unavail.members;
              _rec.blockScope = _unavail.scope; // 'member', 'band', or 'unassigned'
            }
            imported.push(_rec);
          }
        } else {
          // ── Timed event: single record ──
          var eventTime = startStr.length > 10 ? startStr.substring(11, 16) : '';
          var eventEndTime = endStr.length > 10 ? endStr.substring(11, 16) : '';
          var _trec = {
            id: _genId(),
            date: startDate,
            type: inferredType,
            title: summary,
            time: eventTime,
            endTime: eventEndTime,
            location: gEv.location || '',
            notes: gEv.description || '',
            venue: (inferredType === 'gig') ? summary : '',
            isAllDay: false,
            _importedFromGoogle: true,
            _googleSource: summary,
            googleEventId: gEv.id,
            calendarId: bandCalId,
            syncStatus: 'synced',
            lastSyncedAt: new Date().toISOString(),
            sync: { provider: 'google', externalEventId: gEv.id, calendarId: bandCalId, status: 'synced', direction: 'inbound', lastSyncedAt: new Date().toISOString() },
            created: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          if (_unavail.isUnavail) {
            _trec.assignedMembers = _unavail.members;
            _trec.blockScope = _unavail.scope;
          }
          imported.push(_trec);
          console.log('[CalSync] Inbound: importing "' + summary + '" |', startDate, eventTime || 'all-day', '| googleId:', gEv.id);
        }
      });

      // ── Save to Firebase — new imports + upgraded existing events ──
      if (imported.length > 0 || _upgraded > 0) {
        var allEvents = _upgraded > 0 ? existingEvents.concat(imported) : existingEvents.concat(imported);
        await saveBandDataToDrive('_band', 'calendar_events', allEvents);
        console.log('[CalSync] Inbound sync: saved', imported.length, 'new +', _upgraded, 'upgraded event records to Firebase');
      }

      console.log('[CalSync] Inbound sync complete: fetched', googleEvents.length, '| imported', imported.length, '| upgraded', _upgraded, '| skipped', skipped.length);
      skipped.forEach(function(s) { console.log('[CalSync]   skipped:', s.title || s.id, '\u2014', s.reason); });

      return { imported: imported.length, upgraded: _upgraded, skipped: skipped.length, fetched: googleEvents.length, events: imported, error: null };
    } catch(err) {
      console.error('[CalSync] Inbound sync error:', err);
      return { imported: 0, skipped: 0, fetched: 0, events: [], error: err.message };
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
  // CRITICAL: always excludes the band calendar to prevent circular conflicts
  async function _getSelectedCalendarIds() {
    var settings = await getAvailabilitySettings();
    var cals = (settings && settings.selectedCalendars && settings.selectedCalendars.length > 0)
      ? settings.selectedCalendars : ['primary'];
    // Auto-exclude band calendar — band events must never create self-conflicts
    var bandCalId = await _getBandCalendarId();
    if (bandCalId) {
      cals = cals.filter(function(id) { return id !== bandCalId; });
    }
    // Also exclude by name (IDs can differ between users for shared calendars)
    try {
      var _bcName = null;
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var _bcSnap = await db.ref(bandPath('band_calendar/calendarName')).once('value');
        _bcName = _bcSnap.val();
      }
      if (!_bcName) _bcName = (typeof localStorage !== 'undefined') ? localStorage.getItem('deadcetera_band_name') : null;
      if (_bcName && cals.length > 0) {
        var _bcLower = _bcName.toLowerCase();
        // Need calendar list to match name → ID, but only fetch if we have names to check
        var _allCals = await listCalendars();
        _allCals.forEach(function(cal) {
          var _cn = (cal.summary || '').toLowerCase();
          if (_cn === _bcLower || (_bcLower.length > 3 && (_cn.indexOf(_bcLower) !== -1 || _bcLower.indexOf(_cn) !== -1))) {
            cals = cals.filter(function(id) { return id !== cal.id; });
          }
        });
      }
    } catch(e) {}
    if (!cals.length) cals = ['primary'];
    return cals;
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
    // No band calendar configured — return null (callers must check)
    return null;
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
    if (!calId) { _bandCalAccessCache = false; return false; }
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
    getBandEventTimeSlots: _getBandEventTimeSlots,
    syncBandCalendar: syncBandCalendar,
    pullBandCalendarEvents: pullBandCalendarEvents,
    _getBandEmails: _getBandEmails,
    _buildEventBody: _buildEventBody
  };

})();

console.log('\u2705 gl-calendar-sync.js loaded');
