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
    return typeof accessToken !== 'undefined' && accessToken &&
      typeof GOOGLE_DRIVE_CONFIG !== 'undefined' &&
      GOOGLE_DRIVE_CONFIG.scope && GOOGLE_DRIVE_CONFIG.scope.indexOf('calendar') !== -1;
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

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events', {
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
        calendarId: 'primary',
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

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId), {
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

    try {
      var res = await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId), {
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

  // ── FREE/BUSY — query current user's Google Calendar conflicts ────────────
  var _freeBusyCache = null;
  var _freeBusyCacheTime = 0;

  async function getFreeBusy(timeMin, timeMax) {
    if (!hasCalendarScope()) return { busy: [], source: 'unavailable' };
    // Cache for 5 minutes
    var cacheKey = timeMin + '|' + timeMax;
    if (_freeBusyCache && _freeBusyCacheTime > Date.now() - 300000 && _freeBusyCache._key === cacheKey) {
      return _freeBusyCache;
    }
    try {
      var res = await fetch(WORKER_BASE + '/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify({
          timeMin: timeMin,
          timeMax: timeMax,
          items: [{ id: 'primary' }]
        })
      });
      if (!res.ok) return { busy: [], source: 'error' };
      var data = await res.json();
      // Extract busy ranges from primary calendar
      var busy = [];
      if (data.calendars && data.calendars.primary && data.calendars.primary.busy) {
        data.calendars.primary.busy.forEach(function(b) {
          busy.push({ start: b.start, end: b.end });
        });
      }
      _freeBusyCache = { busy: busy, source: 'google', _key: cacheKey };
      _freeBusyCacheTime = Date.now();
      return _freeBusyCache;
    } catch (err) {
      console.warn('[CalSync] Free/busy error:', err);
      return { busy: [], source: 'error' };
    }
  }

  // Convert free/busy ranges to date-based blocked ranges for calendar
  function freeBusyToBlockedRanges(busyData, memberName) {
    if (!busyData || !busyData.busy || !busyData.busy.length) return [];
    var ranges = [];
    var seen = {};
    busyData.busy.forEach(function(b) {
      var startDate = b.start.substring(0, 10);
      var endDate = b.end.substring(0, 10);
      // Dedupe by date (multiple busy periods on same day = one block)
      var key = startDate + '|' + endDate;
      if (seen[key]) return;
      seen[key] = true;
      ranges.push({
        person: memberName || 'You',
        startDate: startDate,
        endDate: endDate,
        reason: 'Busy (Google Calendar)',
        status: 'unavailable',
        _source: 'google'
      });
    });
    return ranges;
  }

  // ── ATTENDEE SYNC — read RSVP status from Google event ──────────────────
  async function syncAttendeeStatus(externalEventId) {
    if (!hasCalendarScope() || !externalEventId) return null;
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
    try {
      var url = WORKER_BASE + '/calendar/events?timeMin=' + encodeURIComponent(timeMin) + '&timeMax=' + encodeURIComponent(timeMax);
      var res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (!res.ok) return [];
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
    _getBandEmails: _getBandEmails,
    _buildEventBody: _buildEventBody
  };

})();

console.log('\u2705 gl-calendar-sync.js loaded');
