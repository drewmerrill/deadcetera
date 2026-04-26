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
    // Title generator: prefer human-readable names over bot-speak.
    // - Gigs: prefer venue name (e.g., "From The Earth Brewing") over "{band} Gig".
    //   The venue is what humans recognize. Falls back to "{band} Gig" only if
    //   no venue is set.
    // - Rehearsals/meetings: keep the existing "{band} Rehearsal" pattern since
    //   it's the natural label and there's no per-event venue to substitute.
    var summary;
    var explicitTitle = (glEvent.title && glEvent.title !== 'Band Rehearsal' && glEvent.title !== 'Rehearsal' && glEvent.title !== 'Gig') ? glEvent.title : '';
    // Normalize for the "already-prefixed" comparison: case-insensitive,
    // collapse whitespace, strip trailing punctuation. Without this, a title
    // like "MoonShadow Tavern — Moonshadow" would not equal venue
    // "MoonShadow Tavern" and the prepend would loop, growing the title by
    // one venue prefix every sync (real bug seen in prod).
    var _norm = function(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
    if (glEvent.type === 'gig') {
      var venueName = glEvent.venue || glEvent.location || '';
      if (venueName) {
        var _vn = _norm(venueName);
        var _et = _norm(explicitTitle);
        // If the explicit title already starts with (or equals) the venue,
        // it's already canonical — use as-is, don't re-prepend the venue.
        if (_et && (_et === _vn || _et.indexOf(_vn) === 0)) {
          summary = explicitTitle;
        } else if (_et) {
          summary = venueName + ' \u2014 ' + explicitTitle;
        } else {
          summary = venueName;
        }
      } else if (explicitTitle) {
        summary = explicitTitle;
      } else {
        summary = (bandName ? bandName + ' ' : '') + 'Gig';
      }
    } else {
      summary = (bandName ? bandName + ' ' : '') + (typeLabel[glEvent.type] || 'Event');
      if (explicitTitle && _norm(explicitTitle) !== _norm(summary) && _norm(explicitTitle).indexOf(_norm(summary)) !== 0) {
        summary += ' \u2014 ' + explicitTitle;
      } else if (explicitTitle) {
        summary = explicitTitle;
      }
    }

    // Description
    var descParts = [];
    if (opts.planSummary) descParts.push('\uD83C\uDFAF ' + opts.planSummary);
    if (glEvent.notes) descParts.push('\uD83D\uDCDD ' + glEvent.notes);
    if (descParts.length) descParts.push('');
    descParts.push('Created with GrooveLinx \u2014 groovelinx.com');

    var body = { summary: summary, description: descParts.join('\n') };

    // Multi-day all-day event: use date (not dateTime) format.
    // Explicit dateTime:null clears any pre-existing timed values so a
    // PATCH from timed → all-day takes effect. Without this, Google
    // sometimes leaves the old dateTime in place alongside the new date.
    if (glEvent.endDate && glEvent.endDate > glEvent.date && (!glEvent.time && !glEvent.startTime)) {
      // Google all-day end date is EXCLUSIVE — add one day
      var _endExcl = new Date(glEvent.endDate + 'T12:00:00');
      _endExcl.setDate(_endExcl.getDate() + 1);
      var _endStr = _endExcl.getFullYear() + '-' + String(_endExcl.getMonth() + 1).padStart(2, '0') + '-' + String(_endExcl.getDate()).padStart(2, '0');
      body.start = { date: glEvent.date, dateTime: null, timeZone: null };
      body.end = { date: _endStr, dateTime: null, timeZone: null };
    } else if (glEvent.isAllDay && !glEvent.time && !glEvent.startTime) {
      // Single all-day event
      var _nextDay = new Date(glEvent.date + 'T12:00:00');
      _nextDay.setDate(_nextDay.getDate() + 1);
      var _ndStr = _nextDay.getFullYear() + '-' + String(_nextDay.getMonth() + 1).padStart(2, '0') + '-' + String(_nextDay.getDate()).padStart(2, '0');
      body.start = { date: glEvent.date, dateTime: null, timeZone: null };
      body.end = { date: _ndStr, dateTime: null, timeZone: null };
    } else {
      // Timed event. Explicit date:null clears any pre-existing all-day
      // value so a PATCH from all-day → timed takes effect — the common
      // workflow where someone creates a placeholder all-day "420 fest"
      // on DC and the band fills in real start/end times in GrooveLinx.
      var time = glEvent.time || glEvent.startTime || '19:00';
      var startDt = new Date(glEvent.date + 'T' + time + ':00');
      if (isNaN(startDt.getTime())) startDt = new Date(glEvent.date + 'T19:00:00');
      // Use provided end time if we have one, else fall back to the default
      // duration. Previously this always added 2 hours, so every gig looked
      // identical (7–9 PM for defaulted starts).
      var endDt;
      if (glEvent.endTime) {
        endDt = new Date(glEvent.date + 'T' + glEvent.endTime + ':00');
        if (isNaN(endDt.getTime()) || endDt.getTime() <= startDt.getTime()) {
          endDt = new Date(startDt.getTime() + CAL_DEFAULT_DURATION_MIN * 60000);
        }
      } else {
        endDt = new Date(startDt.getTime() + CAL_DEFAULT_DURATION_MIN * 60000);
      }
      body.start = { dateTime: startDt.toISOString(), timeZone: 'America/New_York', date: null };
      body.end = { dateTime: endDt.toISOString(), timeZone: 'America/New_York', date: null };
    }

    if (glEvent.venue || glEvent.location) {
      body.location = glEvent.venue || glEvent.location;
    }

    // Attendees — opt-in only. Auto-adding the band on every event causes
    // Google to replicate invite copies onto every member's personal
    // calendar, which makes it look like events are landing in the wrong
    // place + clutters everyone's view. GrooveLinx has its own in-app RSVP
    // so the Google-level invitations are redundant. Only add attendees if
    // the caller explicitly passed an opts.attendees array.
    if (opts.attendees && opts.attendees.length) {
      body.attendees = opts.attendees.map(function(email) { return { email: email }; });
    }

    // Tag as GrooveLinx-created for deterministic circular-conflict suppression.
    // Also persist the original GL event type so on re-import the classifier
    // can preserve "gig" instead of falling back to title-keyword guessing —
    // a venue-only title like "MoonShadow Tavern" was getting tagged 'other'
    // and then converted to member unavailability by the band-cal-source rule.
    // Google extended properties are string-only key/value pairs.
    body.extendedProperties = {
      private: {
        groovelinx: 'true',
        glEventId: opts.glEventId || '',
        glType: glEvent.type || ''
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

  // Reverse lookup: email → member key. Used to attribute un-keyworded
  // band-cal events ("daughter's wedding", "out of town") to whoever
  // created them, so the red-day hover can show "Brian — daughter's
  // wedding" instead of an anonymous block.
  function _memberKeyFromEmail(email) {
    if (!email) return null;
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var lc = String(email).toLowerCase();
    var found = null;
    Object.keys(bm).forEach(function(k) {
      if (bm[k] && bm[k].email && String(bm[k].email).toLowerCase() === lc) found = k;
    });
    return found;
  }

  // Shared classifier — both the live import path (_importGoogleEvent) and
  // the Path B.2 multi-day expansion use this so they can't drift apart.
  // Order: rehearsal/practice wins over jam (a "studio jam" is rehearsal,
  // not a gig). Meeting wins over generic gig keywords.
  function _classifyEventType(summary) {
    var lc = String(summary || '').toLowerCase();
    if (/\brehears|\bpractice/.test(lc)) return 'rehearsal';
    if (/\bband meeting|\bband sync|\bgear talk|\blogistics\b|\bset planning|\bband call/.test(lc)) return 'meeting';
    if (/\bgig\b|\bshow\b|\bconcert\b|\bfest\b|\bfestival\b|\bjam\b|\blive at\b|\bplaying\b|\bopening for\b|\bset @|\balbum release|\brecording session|fb\/event\//.test(lc)) return 'gig';
    // Venue-name fallback — GrooveLinx-stamped gigs already win via glType,
    // but events created directly on Google with venue-only titles benefit
    // from these. Match common venue suffixes.
    if (/\btavern\b|\bbar\b|\bpub\b|\bbrewery\b|\blounge\b|\btap\s?room\b|\bmusic hall\b|\btheatre\b|\btheater\b|\bamphitheat|\bopry\b|\boutpost\b|\bbluebird\b|\bcafe\b|\bcoffeehouse\b/.test(lc)) return 'gig';
    if (/\bmeeting\b/.test(lc)) return 'meeting';
    return 'other';
  }

  // ── CREATE event in Google Calendar ───────────────────────────────────────
  // Query Google for events already tagged with this glEventId. Used as a
  // pre-push dedupe: if a previous sync (same user or a concurrent run on
  // another device) already created this event, we find it and reuse its
  // ID instead of creating a duplicate. Returns array of matching events,
  // oldest first by `created`.
  async function _findByGlEventId(calId, glEventId) {
    if (!calId || !glEventId) return [];
    try {
      var now = new Date();
      var timeMin = new Date(now.getFullYear() - 1, 0, 1).toISOString();
      var timeMax = new Date(now.getFullYear() + 2, 11, 31).toISOString();
      var url = WORKER_BASE + '/calendar/events'
        + '?calendarId=' + encodeURIComponent(calId)
        + '&timeMin=' + encodeURIComponent(timeMin)
        + '&timeMax=' + encodeURIComponent(timeMax)
        + '&maxResults=250'
        + '&privateExtendedProperty=' + encodeURIComponent('glEventId=' + glEventId);
      var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (!res.ok) return [];
      var data = await res.json();
      var items = data.items || [];
      // Defense in depth: even if the worker hasn't been redeployed with
      // privateExtendedProperty passthrough, filter client-side so we never
      // link-to-wrong-event. Only keep items actually tagged with this glEventId.
      items = items.filter(function (ev) {
        var ep = ev.extendedProperties && ev.extendedProperties.private;
        return ep && ep.glEventId === glEventId && ev.status !== 'cancelled';
      });
      items.sort(function (a, b) {
        var ta = Date.parse(a.created || 0), tb = Date.parse(b.created || 0);
        return ta - tb;
      });
      return items;
    } catch (e) {
      console.warn('[CalSync] _findByGlEventId error:', e && e.message);
      return [];
    }
  }

  // Find an event on the band calendar by title + date — used for dedupe
  // when a user creates an event directly on Google (no glEventId tag) and
  // another user later pushes the same gig via GrooveLinx. Returns the
  // earliest-created match, or null. Time-of-day is intentionally ignored
  // — gig start times can drift between the direct-created event and the
  // GrooveLinx version, and we'd rather match once than double-create.
  async function _findByTitleAndDate(calId, title, dateStr) {
    if (!calId || !title || !dateStr) return null;
    // Don't auto-dedupe unavailability events. Two members can both have
    // "Out" or "Busy" on the same day — those are distinct people's blocks,
    // not a single event we should collapse. Generic words like "rehearsal"
    // also collide; only run the dedupe for titles that look gig-specific.
    var _lc = String(title).toLowerCase().trim();
    if (/^(busy|out|off|away|unavailable|blocked|conflict|free|tbd|hold)\b/.test(_lc)
        || /\b(busy|out|off|unavail)\b/.test(_lc) && _lc.length < 25) {
      console.log('[CalSync] _findByTitleAndDate: skipping dedupe for unavailability-pattern title:', JSON.stringify(title));
      return null;
    }
    try {
      // Query a narrow window — start of target day to end of next day
      var _start = new Date(dateStr + 'T00:00:00').toISOString();
      var _endDate = new Date(dateStr + 'T00:00:00');
      _endDate.setDate(_endDate.getDate() + 1);
      var _end = _endDate.toISOString();
      var url = WORKER_BASE + '/calendar/events'
        + '?calendarId=' + encodeURIComponent(calId)
        + '&timeMin=' + encodeURIComponent(_start)
        + '&timeMax=' + encodeURIComponent(_end)
        + '&maxResults=50';
      var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (!res.ok) return null;
      var data = await res.json();
      var items = (data.items || []).filter(function(ev) {
        if (!ev || ev.status === 'cancelled') return false;
        // Skip events that already have a glEventId tag — those are dedupe'd
        // via _findByGlEventId and aren't the target of this fallback.
        var ep = ev.extendedProperties && ev.extendedProperties.private;
        if (ep && ep.glEventId) return false;
        return String(ev.summary || '').trim() === String(title).trim();
      });
      if (!items.length) return null;
      items.sort(function(a, b) {
        var ta = Date.parse(a.created || 0), tb = Date.parse(b.created || 0);
        return ta - tb;
      });
      return items[0];
    } catch(e) {
      console.warn('[CalSync] _findByTitleAndDate error:', e && e.message);
      return null;
    }
  }

  async function create(glEvent, opts) {
    if (!hasCalendarScope()) {
      return _fallbackUrl(glEvent, opts);
    }

    var glEventId = glEvent.id || glEvent.eventId || '';
    var _opts = Object.assign({}, opts, { glEventId: glEventId });
    var body = _buildEventBody(glEvent, _opts);
    var calId = await _getBandCalendarId();
    if (!calId) return { success: false, error: 'No band calendar configured. Open Rules to set one up.' };

    // Pre-push dedupe: if an event with this glEventId already exists on the
    // band calendar (any member previously pushed it), link to the earliest
    // one and delete any orphan siblings. Prevents the Brian/Drew duplicate
    // race mode where both users pushed the same event in separate sessions.
    if (glEventId) {
      var existing = await _findByGlEventId(calId, glEventId);
      if (existing.length > 0) {
        var keeper = existing[0];
        console.log('[CalSync] Pre-push dedupe: found', existing.length, 'existing for glEventId=' + glEventId + ' — reusing', keeper.id);
        // Clean up any orphan siblings created by earlier race conditions.
        for (var ei = 1; ei < existing.length; ei++) {
          try {
            await remove(existing[ei].id);
            console.log('[CalSync] Pre-push dedupe: deleted orphan', existing[ei].id);
          } catch (e) { console.warn('[CalSync] Failed to delete orphan', existing[ei].id, e.message); }
        }
        return {
          success: true,
          deduped: true,
          sync: {
            provider: 'google',
            externalEventId: keeper.id,
            calendarId: calId,
            htmlLink: keeper.htmlLink || null,
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            lastSyncDirection: 'link-existing',
            syncedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
            etag: keeper.etag || null,
            attendees: []
          },
          htmlLink: keeper.htmlLink
        };
      }
    }

    // Title+date dedupe (#8): catches the case where a member created the event
    // directly on Google Calendar (so it has no glEventId tag) and another
    // member then creates the same gig/rehearsal in GrooveLinx. Without this,
    // we'd POST a duplicate. Match by summary + start-date; tolerate time skew.
    try {
      var _matchTitle = body.summary || '';
      var _matchDate = glEvent.date || '';
      if (_matchTitle && _matchDate) {
        var _twin = await _findByTitleAndDate(calId, _matchTitle, _matchDate);
        if (_twin) {
          console.log('[CalSync] Title-match dedupe: linking to existing untagged event', _twin.id, _matchTitle, _matchDate);
          return {
            success: true,
            deduped: true,
            sync: {
              provider: 'google',
              externalEventId: _twin.id,
              calendarId: calId,
              htmlLink: _twin.htmlLink || null,
              status: 'synced',
              lastSyncedAt: new Date().toISOString(),
              lastSyncDirection: 'link-existing-by-title',
              syncedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
              etag: _twin.etag || null,
              attendees: []
            },
            htmlLink: _twin.htmlLink
          };
        }
      }
    } catch(e) { console.warn('[CalSync] Title-match dedupe skipped:', e && e.message); }

    try {
      var _postUrl = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(calId);
      // Diagnostic: log exactly what calendar the create POST targets so
      // "did the event land on the right calendar?" can be answered in 5
      // seconds from the console without right-click-investigating in
      // Google Calendar.
      console.log('[CalSync] create() POST URL =', _postUrl);
      console.log('[CalSync] create() event:', { title: body.summary, type: glEvent.type, date: glEvent.date });
      var res = await fetch(_postUrl, {
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
        attendees: []
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

    // Defensive: verify the event actually exists on the band cal before
    // PATCHing. If the stored googleEventId is an orphan (e.g. from a
    // legacy auto-attendee replica that lived on someone's personal cal),
    // the PATCH could route somewhere unexpected. Pre-check so we fail
    // loudly instead of mutating the wrong calendar.
    try {
      var checkUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId) + '?calendarId=' + encodeURIComponent(calId);
      var checkRes = await fetch(checkUrl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (checkRes.status === 404 || checkRes.status === 410) {
        console.warn('[CalSync] update() refused — event', externalEventId, 'does not exist on band calendar', calId, '. Likely an orphaned googleEventId from legacy auto-attendee era. Caller should clear googleEventId and create fresh.');
        return { success: false, error: 'orphan_event_id', status: 'orphan', orphanGoogleId: externalEventId };
      }
    } catch(_e) {
      // Network error — proceed to PATCH anyway (Google API will give us the
      // real verdict). Log so any post-hoc "why did the orphan check skip"
      // questions can be answered without guessing.
      console.warn('[CalSync] update() pre-check network error — proceeding to PATCH anyway:', _e && _e.message);
    }

    var patchUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId) + '?calendarId=' + encodeURIComponent(calId);
    console.log('[CalSync] update() PATCH URL =', patchUrl);
    console.log('[CalSync] update() PATCH body.start =', body.start, '| body.end =', body.end, '| body.summary =', body.summary);
    try {
      var res = await fetch(patchUrl, {
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
        await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
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
      // Always read from the band cal — the worker's previous hardcode to
      // 'primary' meant attendee status was being read from the user's
      // personal calendar (wrong/empty data for events that live on DC).
      var _calId = await _getBandCalendarId();
      var _url = WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId)
        + (_calId ? ('?calendarId=' + encodeURIComponent(_calId)) : '');
      var res = await fetch(_url, {
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

  // Firebase .set() rejects any object containing undefined values and
  // silently fails the whole save. Walks an object or array tree and
  // replaces undefined with null in place. Safe to call on plain data.
  function _sanitizeForFirebase(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) value[i] = _sanitizeForFirebase(value[i]);
      return value;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        if (value[k] === undefined) { value[k] = null; return; }
        value[k] = _sanitizeForFirebase(value[k]);
      });
      return value;
    }
    return value;
  }

  // ── Unavailability detection ───────────────────────────────────────────────
  // Classifies an event title as blocking for members / band / unassigned based
  // on keyword + member-name matching. Extracted to module scope so both the
  // two-way sync (syncBandCalendar) and the legacy inbound pull
  // (pullBandCalendarEvents) use the same logic. Previously only the latter
  // ran this check, so "Brian busy" events imported via Sync Calendars stayed
  // as type='other' and never blocked availability.
  var _STRONG_UNAVAIL_KW = ['out', 'unavailable', 'pto', 'vacation', 'away', 'travel'];
  var _WEAK_UNAVAIL_KW = ['busy', 'conflict', 'off', 'blocked'];
  var _WHOLE_BAND_PHRASES = ['band off', 'full band off', 'everyone out', 'no rehearsal', 'band unavailable', 'all out', 'band away'];

  function _buildMemberNameIndex() {
    var memberNames = {};
    var allKeys = [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    Object.keys(bm).forEach(function (k) {
      var name = bm[k] && bm[k].name ? bm[k].name : '';
      if (name) {
        memberNames[name.split(' ')[0].toLowerCase()] = k;
        memberNames[name.toLowerCase()] = k;
      }
      allKeys.push(k);
    });
    return { memberNames: memberNames, allKeys: allKeys };
  }

  function _detectUnavailability(title) {
    if (!title) return { isUnavail: false };
    var lc = title.toLowerCase().trim();
    for (var wp = 0; wp < _WHOLE_BAND_PHRASES.length; wp++) {
      if (lc.indexOf(_WHOLE_BAND_PHRASES[wp]) !== -1) {
        var idx = _buildMemberNameIndex();
        return { isUnavail: true, scope: 'band', members: idx.allKeys.slice() };
      }
    }
    var hasStrongKw = _STRONG_UNAVAIL_KW.some(function (kw) {
      var i = lc.indexOf(kw);
      if (i === -1) return false;
      var before = i > 0 ? lc[i - 1] : ' ';
      var after = i + kw.length < lc.length ? lc[i + kw.length] : ' ';
      var okBefore = /[\s\-\u2013\u2014,.:;!?/]/.test(before) || i === 0;
      var okAfter  = /[\s\-\u2013\u2014,.:;!?/]/.test(after) || i + kw.length === lc.length;
      return okBefore && okAfter;
    });
    var hasWeakKw = !hasStrongKw && _WEAK_UNAVAIL_KW.some(function (kw) { return lc.indexOf(kw) !== -1; });
    if (!hasStrongKw && !hasWeakKw) return { isUnavail: false };
    var idx = _buildMemberNameIndex();
    var matched = [];
    Object.keys(idx.memberNames).forEach(function (n) {
      if (n.length < 2) return;
      if (lc.indexOf(n) !== -1) {
        var key = idx.memberNames[n];
        if (matched.indexOf(key) === -1) matched.push(key);
      }
    });
    if (hasStrongKw && matched.length > 0) return { isUnavail: true, scope: 'member', members: matched };
    if (hasWeakKw && matched.length > 0)   return { isUnavail: true, scope: 'member', members: matched };
    if (hasStrongKw && matched.length === 0) return { isUnavail: true, scope: 'unassigned', members: [] };
    return { isUnavail: false };
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
          description: ev.description || '',
          organizerEmail: (ev.organizer && ev.organizer.email) || (ev.creator && ev.creator.email) || '',
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

  // ── RECONCILIATION RULES (Shared Calendar Mode) ──────────────────────────
  // IDENTITY: googleEventId is the stable primary key. No fuzzy matching.
  // SCHEDULING FIELDS (Google wins): date, time, endTime, isAllDay
  // SHARED FIELDS (Google wins if changed): title, location, notes/description
  // GL-ONLY METADATA (always preserved): type, venueId, linkedSetlist,
  //   availability, assignedMembers, gigId, blockScope, _importedFromGoogle,
  //   RSVP data, _googleSource
  // DELETION: Google deletion removes from GrooveLinx. GrooveLinx deletion
  //   removes from Google (via Phase 3). Last-delete-wins.
  function _reconcileEvent(existing, googleEvent) {
    // App-side dirty edits MUST NOT be clobbered by Google's older data.
    // If the user updated the event in GrooveLinx and the push back to
    // Google hasn't landed yet (e.g. Phase B2 silent failure, network
    // glitch), reconcile would otherwise reset times/title to whatever
    // Google still has. Skip — Phase 1 update push will take care of
    // landing the dirty edits on Google on the next sync.
    var _existingStatus = (existing && (existing.syncStatus || (existing.sync && existing.sync.status))) || '';
    if (_existingStatus === 'dirty') {
      // CONFLICT WARNING: if Google's copy has a NEWER updated time than
      // our local dirty edit, another band member updated it after our edit
      // started. Skipping reconcile preserves our edit but loses theirs
      // until next push lands. Surface the gap so it's diagnosable.
      var _googleUpdated = googleEvent.updated || (googleEvent.start && googleEvent.start.dateTime) || '';
      var _localUpdated = existing.updated_at || '';
      var _hasNewerGoogle = _googleUpdated && _localUpdated && _googleUpdated > _localUpdated;
      console.log('[CalSync] _reconcileEvent: SKIPPING dirty event "' + (existing.title || existing.id) + '" @ ' + (existing.date || '?')
        + ' — local edits will be pushed on next sync.'
        + (_hasNewerGoogle ? ' \u26A0 Google has newer changes (' + _googleUpdated + ' vs local ' + _localUpdated + ') — those will be lost when our push lands.' : ''));
      return existing;
    }
    var isAllDay = !!(googleEvent.start && googleEvent.start.date && !googleEvent.start.dateTime);
    var startStr = googleEvent.start ? (googleEvent.start.dateTime || googleEvent.start.date || '') : '';
    var endStr = googleEvent.end ? (googleEvent.end.dateTime || googleEvent.end.date || '') : '';
    // Scheduling fields — Google is source of truth. Default to '' rather
    // than letting undefined propagate: Firebase .set() rejects the entire
    // document if any field is undefined, which silently loses reclassify
    // and every other Phase 2 update in the same save.
    existing.date = startStr.substring(0, 10) || '';
    var _rawTitle = googleEvent.summary || existing.title || '';
    // Self-heal: collapse repeated venue prefixes in gig titles.
    // Past _buildEventBody bug compounded "Venue — Title" into
    // "Venue — Venue — Venue — Title" once per sync. Detect, strip, and
    // mark dirty so the push back to Google fixes the source copy too.
    var _titleWasCorrupt = false;
    if (existing.type === 'gig' && existing.venue && _rawTitle) {
      var _vRaw = existing.venue.trim();
      if (_vRaw) {
        var _esc = _vRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var _repeatRe = new RegExp('^(?:' + _esc + '\\s*\\u2014\\s*){2,}', 'i');
        if (_repeatRe.test(_rawTitle)) {
          var _cleaned = _rawTitle.replace(_repeatRe, _vRaw + ' \u2014 ');
          // If after collapse the trailing segment is just the venue, drop the dash.
          _cleaned = _cleaned.replace(new RegExp('^' + _esc + '\\s*\\u2014\\s*' + _esc + '\\s*$', 'i'), _vRaw);
          if (_cleaned !== _rawTitle) {
            console.log('[CalSync] Cleaned compounded title "' + _rawTitle + '" -> "' + _cleaned + '"');
            _rawTitle = _cleaned;
            _titleWasCorrupt = true;
          }
        }
      }
    }
    existing.title = _rawTitle;
    existing.location = googleEvent.location || existing.location || '';
    existing.notes = googleEvent.description || existing.notes || '';
    existing.isAllDay = isAllDay;
    // Multi-day span → set endDate so _calBuildDateMap expands the event across
    // every covered day. All-day spans use Google's exclusive end date (minus 1);
    // timed spans use the date portion, treating midnight-to-midnight like
    // all-day (end-midnight is effectively the prior day).
    var _startDateR = (startStr || '').substring(0, 10);
    var _endDateR = (endStr || '').substring(0, 10);
    if (isAllDay && endStr) {
      var _rEnd = new Date(_endDateR + 'T12:00:00');
      _rEnd.setDate(_rEnd.getDate() - 1);
      var _rEndStr = _rEnd.getFullYear() + '-' + String(_rEnd.getMonth() + 1).padStart(2, '0') + '-' + String(_rEnd.getDate()).padStart(2, '0');
      existing.endDate = _rEndStr > _startDateR ? _rEndStr : '';
    } else if (!isAllDay && endStr && _endDateR > _startDateR) {
      var _rIsEndMid = endStr.length > 10 && endStr.substring(11, 16) === '00:00';
      if (_rIsEndMid) {
        var _rEnd2 = new Date(_endDateR + 'T12:00:00');
        _rEnd2.setDate(_rEnd2.getDate() - 1);
        var _rEndStr2 = _rEnd2.getFullYear() + '-' + String(_rEnd2.getMonth() + 1).padStart(2, '0') + '-' + String(_rEnd2.getDate()).padStart(2, '0');
        existing.endDate = _rEndStr2 > _startDateR ? _rEndStr2 : '';
      } else {
        existing.endDate = _endDateR;
      }
    } else {
      existing.endDate = '';
    }
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
    // If we just stripped a corrupted compounded title, mark dirty so the
    // next push pass writes the cleaned version back to Google. Otherwise
    // the source copy stays corrupt forever.
    existing.sync.status = _titleWasCorrupt ? 'dirty' : 'synced';
    // Capture organizer email (Mode A attribution fallback).
    if (googleEvent.organizer && googleEvent.organizer.email) existing.organizerEmail = googleEvent.organizer.email;
    else if (googleEvent.creator && googleEvent.creator.email) existing.organizerEmail = googleEvent.creator.email;
    // Type-correction pass — runs on every reconcile so prior misclassifications
    // self-heal once the source signals are right.
    var _epRec = (googleEvent.extendedProperties && googleEvent.extendedProperties.private) || {};
    var _glTypeRec = (_epRec.glType || '').toLowerCase();
    var _validRec = { gig: 1, rehearsal: 1, meeting: 1, unavailable: 1, other: 1 };
    if (_validRec[_glTypeRec]) {
      // Authoritative: GrooveLinx stamped this event with its type — adopt it.
      existing.type = _glTypeRec;
      // Drop stale member attribution when the type isn't unavailable.
      if (_glTypeRec !== 'unavailable' && _glTypeRec !== 'unavailable_unassigned') {
        existing.assignedMembers = null;
        existing.blockScope = null;
      }
    } else if (existing.type !== 'rehearsal' && existing.type !== 'gig' && existing.type !== 'meeting') {
      var _un = _detectUnavailability(googleEvent.summary || '');
      if (_un.isUnavail && _un.scope !== 'unassigned') {
        existing.type = 'unavailable';
        existing.assignedMembers = _un.members;
        existing.blockScope = _un.scope;
      } else if (_un.isUnavail && _un.scope === 'unassigned' && existing.type !== 'unavailable') {
        existing.type = 'unavailable_unassigned';
      } else {
        // No glType, no unavailability signal — try the title classifier.
        // Heals records that were imported as 'other' (or auto-attributed
        // to unavailability by the band-cal-source rule) before the
        // classifier knew about venue keywords.
        var _classified = _classifyEventType(googleEvent.summary || '');
        if (_classified === 'gig' || _classified === 'rehearsal' || _classified === 'meeting') {
          existing.type = _classified;
          existing.assignedMembers = null;
          existing.blockScope = null;
        }
      }
    }
    // Preserve GrooveLinx-only metadata: type, venueId, linkedSetlist, availability,
    // assignedMembers, gigId, blockScope, _importedFromGoogle — these are never
    // overwritten by the scheduling-field sync above.
    return existing;
  }

  // Build a new GrooveLinx event from a Google event (for first-time imports)
  function _importGoogleEvent(googleEvent, bandCalId) {
    var isAllDay = !!(googleEvent.start && googleEvent.start.date && !googleEvent.start.dateTime);
    var startStr = googleEvent.start ? (googleEvent.start.dateTime || googleEvent.start.date || '') : '';
    var endStr = googleEvent.end ? (googleEvent.end.dateTime || googleEvent.end.date || '') : '';
    var summary = googleEvent.summary || 'Google Event';
    // GrooveLinx-stamped events carry their original type as a private
    // extended property — trust it over the title-keyword classifier so a
    // gig at "MoonShadow Tavern" stays a gig instead of being downgraded
    // to 'other' (and then to unavailable by the band-cal-source rule).
    var _epPrivate = (googleEvent.extendedProperties && googleEvent.extendedProperties.private) || {};
    var _glType = (_epPrivate.glType || '').toLowerCase();
    var _validGlTypes = { gig: 1, rehearsal: 1, meeting: 1, unavailable: 1, other: 1 };
    var inferredType = _validGlTypes[_glType] ? _glType : _classifyEventType(summary);
    // Unavailability classification (only if not already a rehearsal/gig/meeting).
    // Without this the sync-pull path imported "Brian busy" as type='other'
    // and never blocked anyone's availability.
    var _unavailImport = { isUnavail: false };
    if (inferredType !== 'rehearsal' && inferredType !== 'gig' && inferredType !== 'meeting') {
      _unavailImport = _detectUnavailability(summary);
      if (_unavailImport.isUnavail) {
        inferredType = _unavailImport.scope === 'unassigned' ? 'unavailable_unassigned' : 'unavailable';
      }
    }
    // Mode A band-cal-source rule: if the event landed on the shared band
    // calendar and didn't classify as anything specific, treat it as a
    // member-attributed unavailability — title becomes the reason, creator
    // email maps to the member key. The band cal is source of truth in
    // Mode A; anything on it is band-relevant by definition. SKIP for
    // GrooveLinx-stamped events — those already have a real type.
    var _creatorEmail = (googleEvent.creator && googleEvent.creator.email) || (googleEvent.organizer && googleEvent.organizer.email) || '';
    var _isGlStamped = _epPrivate.groovelinx === 'true';
    if (inferredType === 'other' && bandCalId && !_unavailImport.isUnavail && !_isGlStamped) {
      var _creatorKey = _memberKeyFromEmail(_creatorEmail);
      if (_creatorKey) {
        inferredType = 'unavailable';
        _unavailImport = { isUnavail: true, scope: 'member', members: [_creatorKey] };
      }
    }
    var eventTime = (!isAllDay && startStr.length > 10) ? startStr.substring(11, 16) : '';
    var eventEndTime = (!isAllDay && endStr.length > 10) ? endStr.substring(11, 16) : '';
    // Multi-day spans: store as single event with endDate so the calendar-grid
    // expansion (in _calBuildDateMap) places the event on every day in range.
    // - All-day: Google's end.date is exclusive → subtract 1 day.
    // - Timed: derive from end.dateTime. Midnight-to-midnight spans are treated
    //   like all-day (the end midnight is effectively the prior day), which
    //   matches how Google's UI renders "Pierce out 6/12–15 midnight-to-midnight"
    //   as a 3-day banner across 6/12, 6/13, 6/14.
    var eventEndDate = '';
    var _startDateOnly = startStr.substring(0, 10);
    var _endDateOnly = endStr.substring(0, 10);
    if (isAllDay && endStr) {
      var _endDt = new Date(_endDateOnly + 'T12:00:00');
      _endDt.setDate(_endDt.getDate() - 1); // Google exclusive → inclusive
      var _endInclusive = _endDt.getFullYear() + '-' + String(_endDt.getMonth() + 1).padStart(2, '0') + '-' + String(_endDt.getDate()).padStart(2, '0');
      if (_endInclusive > _startDateOnly) eventEndDate = _endInclusive;
    } else if (!isAllDay && endStr && _endDateOnly > _startDateOnly) {
      // Timed multi-day event. If end is exactly midnight, the effective last
      // day is the day before (Google UI also renders it that way).
      var _isEndMidnight = endStr.length > 10 && endStr.substring(11, 16) === '00:00';
      if (_isEndMidnight) {
        var _endDt2 = new Date(_endDateOnly + 'T12:00:00');
        _endDt2.setDate(_endDt2.getDate() - 1);
        var _endInc2 = _endDt2.getFullYear() + '-' + String(_endDt2.getMonth() + 1).padStart(2, '0') + '-' + String(_endDt2.getDate()).padStart(2, '0');
        if (_endInc2 > _startDateOnly) eventEndDate = _endInc2;
      } else {
        eventEndDate = _endDateOnly;
      }
    }

    return {
      id: (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: startStr.substring(0, 10),
      endDate: eventEndDate,
      type: inferredType,
      title: summary,
      time: eventTime,
      endTime: eventEndTime,
      location: googleEvent.location || '',
      notes: googleEvent.description || '',
      venue: (inferredType === 'gig') ? summary : '',
      // When type is unavailable, record which members are blocked so the
      // availability engine can apply it. Default to null (not undefined —
      // Firebase rejects undefined values and fails the whole save).
      assignedMembers: (_unavailImport && _unavailImport.isUnavail && _unavailImport.scope !== 'unassigned') ? _unavailImport.members : null,
      blockScope: (_unavailImport && _unavailImport.isUnavail) ? _unavailImport.scope : null,
      // Google event creator email — used in Mode A to attribute un-keyworded
      // events ("Out", "Vacation") to the member who created them.
      organizerEmail: (googleEvent.organizer && googleEvent.organizer.email) || (googleEvent.creator && googleEvent.creator.email) || null,
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

  // ── Sync lock ─────────────────────────────────────────────────────────────
  // Firebase-based soft lock to prevent concurrent syncBandCalendar() runs
  // across devices. Each run acquires the lock with a 60s TTL; other runs
  // see the lock and back off. Prevents the Brian/Drew race where both
  // devices pushed the same event because neither had yet written the
  // googleEventId back to Firebase.
  var LOCK_TTL_MS = 60 * 1000;
  async function _acquireSyncLock() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return true;
    try {
      var ref = firebaseDB.ref(bandPath('sync_locks/calendar'));
      var result = await ref.transaction(function (curr) {
        var now = Date.now();
        if (curr && curr.expires && curr.expires > now) return; // abort — someone else holds
        return { owner: (typeof currentUserEmail !== 'undefined' ? currentUserEmail : 'unknown'), expires: now + LOCK_TTL_MS };
      });
      return !!result.committed;
    } catch (e) {
      console.warn('[CalSync] lock acquire failed, proceeding:', e && e.message);
      return true; // fail open — don't block sync on Firebase lock issues
    }
  }
  async function _releaseSyncLock() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return;
    try { await firebaseDB.ref(bandPath('sync_locks/calendar')).remove(); }
    catch (e) { /* non-fatal — lock will expire via TTL */ }
  }

  async function syncBandCalendar() {
    if (!hasCalendarScope()) return { error: 'no scope', pushed: 0, pulled: 0, deleted: 0 };
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) return { error: 'no band calendar configured', pushed: 0, pulled: 0, deleted: 0 };

    var gotLock = await _acquireSyncLock();
    if (!gotLock) {
      console.log('[CalSync] Another device is syncing — skipping this run');
      return { error: 'another_device_syncing', pushed: 0, pulled: 0, deleted: 0, skipped: true };
    }
    var _started = Date.now();
    try {
      var _r = await _syncBandCalendarImpl(bandCalId);
      _r._durationMs = Date.now() - _started;
      // Task #13: log sync activity. Non-fatal on failure.
      _logSyncActivity(_r).catch(function(){});
      return _r;
    } finally {
      await _releaseSyncLock();
    }
  }

  // Task #13: Sync activity log. Each sync run appends an entry at
  // `bands/{slug}/sync_activity`. Trimmed to last 100 entries band-wide on
  // each write. Visible in the Google panel → "Sync activity" modal.
  async function _logSyncActivity(r) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
      var _myKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey)
        ? FeedActionState.getMyMemberKey() : null;
      var _myName = '';
      if (_myKey && typeof bandMembers !== 'undefined' && bandMembers[_myKey] && bandMembers[_myKey].name) {
        _myName = bandMembers[_myKey].name;
      } else if (typeof currentUserName !== 'undefined' && currentUserName) {
        _myName = currentUserName;
      }
      var entry = {
        ts: new Date().toISOString(),
        memberKey: _myKey || 'unknown',
        memberName: _myName || 'unknown',
        pushed: r.pushed || 0,
        pulled: r.pulled || 0,
        updated: r.updated || 0,
        deleted: r.deleted || 0,
        blocksPushed: r.blocksPushed || 0,
        blocksDeleted: r.blocksDeleted || 0,
        hiddenCount: (r.hiddenRanges || []).length,
        error: r.error || null,
        needsReauth: !!r.needsReauth,
        skipped: !!r.skipped,
        durationMs: r._durationMs || 0
      };
      await db.ref(bandPath('sync_activity')).push(entry);
      // Trim to last 100 — one extra read+writes per sync, acceptable.
      var snap = await db.ref(bandPath('sync_activity')).orderByKey().once('value');
      var val = snap.val() || {};
      var keys = Object.keys(val);
      if (keys.length > 100) {
        keys.sort();
        var toDrop = keys.slice(0, keys.length - 100);
        var updates = {};
        toDrop.forEach(function(k) { updates[k] = null; });
        await db.ref(bandPath('sync_activity')).update(updates);
      }
    } catch(e) { /* non-fatal */ }
  }

  async function getSyncActivity(limit) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
      var snap = await db.ref(bandPath('sync_activity'))
        .orderByKey()
        .limitToLast(limit || 50)
        .once('value');
      var val = snap.val() || {};
      return Object.keys(val).sort().reverse().map(function(k) {
        var v = val[k]; v._id = k; return v;
      });
    } catch(e) { return []; }
  }

  // ── Path B: Hidden-event detection (freebusy-vs-events-list diff) ─────────
  // Freebusy returns busy ranges for ALL events on a calendar, including those
  // with Private visibility that events.list hides from API callers. Diffing
  // the two surfaces "ghost busy time" — almost always a member who created an
  // event with Default visibility while their account default is Private.
  async function _queryBandCalendarFreeBusy(bandCalId, timeMin, timeMax) {
    if (!bandCalId) return null;
    try {
      var res = await fetch(WORKER_BASE + '/calendar/freebusy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify({ timeMin: timeMin, timeMax: timeMax, items: [{ id: bandCalId }] })
      });
      if (!res.ok) {
        var _err = '';
        try { _err = await res.text(); } catch(e) {}
        console.warn('[CalSync] Hidden-check freebusy failed:', res.status, _err);
        return null;
      }
      var data = await res.json();
      var cal = data.calendars && data.calendars[bandCalId];
      if (!cal) return [];
      if (cal.errors && cal.errors.length) {
        console.warn('[CalSync] Hidden-check freebusy calendar errors:', cal.errors);
        return null;
      }
      return cal.busy || [];
    } catch(e) {
      console.warn('[CalSync] Hidden-check freebusy error:', e && e.message);
      return null;
    }
  }

  function _computeHiddenRanges(fbRanges, visibleEvents) {
    if (!fbRanges || !fbRanges.length) return [];
    // Merge visible event intervals.
    //
    // CRITICAL: Google's all-day events use {start.date, end.date} (no time).
    // `new Date('2026-04-27')` parses as UTC midnight, but Google's freebusy
    // API returns busy ranges aligned to the user's LOCAL timezone. For ET
    // that's a 4-hour offset, which produces phantom "20:00–23:59" hidden
    // ranges at the trailing edge of every multi-day all-day event.
    //
    // Fix: treat date-only start/end as midnight in local time, then convert
    // to UTC by adding the local offset. This makes our intervals match
    // freebusy exactly.
    var _localizeAllDay = function(dateStr) {
      // `new Date('2026-04-27T00:00:00')` (no Z) is parsed as LOCAL by JS.
      return new Date(dateStr + 'T00:00:00').getTime();
    };
    var intervals = [];
    (visibleEvents || []).forEach(function(g) {
      if (!g || g.status === 'cancelled' || !g.start) return;
      var sStr = g.start.dateTime || g.start.date;
      var eStr = (g.end && (g.end.dateTime || g.end.date)) || sStr;
      if (!sStr || !eStr) return;
      var _isAllDay = !g.start.dateTime; // start.date only → all-day
      var s = _isAllDay ? _localizeAllDay(sStr) : new Date(sStr).getTime();
      var e = _isAllDay ? _localizeAllDay(eStr) : new Date(eStr).getTime();
      if (isNaN(s) || isNaN(e) || e <= s) return;
      intervals.push({ start: s, end: e });
    });
    intervals.sort(function(a, b) { return a.start - b.start; });
    var merged = [];
    intervals.forEach(function(r) {
      if (merged.length && r.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
      } else {
        merged.push({ start: r.start, end: r.end });
      }
    });

    var MIN_GAP_MS = 5 * 60 * 1000; // ignore < 5 min slivers (timezone/rounding noise)
    var hidden = [];
    fbRanges.forEach(function(b) {
      var bs = new Date(b.start).getTime();
      var be = new Date(b.end).getTime();
      if (isNaN(bs) || isNaN(be) || be <= bs) return;
      var cur = [{ start: bs, end: be }];
      merged.forEach(function(sub) {
        var next = [];
        cur.forEach(function(seg) {
          if (sub.end <= seg.start || sub.start >= seg.end) {
            next.push(seg);
          } else {
            if (sub.start > seg.start) next.push({ start: seg.start, end: sub.start });
            if (sub.end < seg.end) next.push({ start: sub.end, end: seg.end });
          }
        });
        cur = next;
      });
      cur.forEach(function(seg) {
        if (seg.end - seg.start >= MIN_GAP_MS) {
          hidden.push({
            start: new Date(seg.start).toISOString(),
            end: new Date(seg.end).toISOString()
          });
        }
      });
    });
    return hidden;
  }

  // Fetch ALL visible events for the band cal over the full window, then diff
  // against freebusy. Runs on every sync (not gated by syncToken), so hidden
  // events are caught even on incremental syncs.
  async function _runHiddenEventCheck(bandCalId) {
    if (!bandCalId || !accessToken) return null;
    try {
      // Window: 7 days back (to catch recent-past items the band may still be
      // reconciling) through 6 months forward. Past history beyond that is
      // noise and inflates the banner list unhelpfully.
      var _now = new Date();
      var _minDate = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000);
      var _min = _minDate.toISOString();
      var _max = new Date(_now.getFullYear(), _now.getMonth() + 6, 0, 23, 59, 59).toISOString();

      // Paginated full-window events.list
      var allEvents = [];
      var pageToken = null;
      var pages = 0;
      do {
        pages++;
        if (pages > 10) break; // safety cap
        var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId)
          + '&timeMin=' + encodeURIComponent(_min)
          + '&timeMax=' + encodeURIComponent(_max)
          + '&maxResults=250';
        if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (!res.ok) {
          console.warn('[CalSync] Hidden-check events.list failed:', res.status);
          return null;
        }
        var data = await res.json();
        allEvents = allEvents.concat(data.items || []);
        pageToken = data.nextPageToken || null;
      } while (pageToken);

      // Google's freeBusy.query caps range width per request. Some accounts
      // hard-fail at > ~90 days with a 400; chunk into 30-day windows to be
      // safe across account types. Merge results.
      var CHUNK_MS = 30 * 24 * 60 * 60 * 1000;
      var _minMs = new Date(_min).getTime();
      var _maxMs = new Date(_max).getTime();
      var fb = [];
      var fbFailed = false;
      for (var _c = _minMs; _c < _maxMs; _c += CHUNK_MS) {
        var cMin = new Date(_c).toISOString();
        var cMax = new Date(Math.min(_c + CHUNK_MS, _maxMs)).toISOString();
        var part = await _queryBandCalendarFreeBusy(bandCalId, cMin, cMax);
        if (part === null) { fbFailed = true; break; }
        fb = fb.concat(part);
      }
      if (fbFailed) return null;

      var hidden = _computeHiddenRanges(fb, allEvents);
      console.log('[CalSync] Hidden-event check:',
        fb.length, 'freebusy ranges |',
        allEvents.length, 'visible events |',
        hidden.length, 'hidden');
      if (hidden.length) {
        console.log('[CalSync] Hidden ranges (first 10):');
        hidden.slice(0, 10).forEach(function(h) {
          console.log('  ', h.start, '\u2192', h.end);
        });
      }
      return hidden;
    } catch(e) {
      console.warn('[CalSync] Hidden-event check error:', e && e.message);
      return null;
    }
  }

  async function _syncBandCalendarImpl(bandCalId) {
    console.log('[CalSync] === TWO-WAY SYNC START === | bandCalId=', bandCalId);
    var syncState = await _loadSyncState();
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var result = { pushed: 0, pulled: 0, updated: 0, deleted: 0, error: null };

    // ── PHASE 1: Push local changes to Google ──
    // Two flavors: CREATE for events that have never synced, UPDATE for
    // events whose sync.status === 'dirty' (user edited in the app since
    // last sync). Without the UPDATE flavor, app-side edits to imported
    // events would only push via calSaveEvent's immediate Phase B2 — and
    // if that ever failed silently, the changes would be invisible until
    // Phase 2 reconcile clobbered them with Google's older data.
    console.log('[CalSync] Phase 1: Push local changes...');
    result.pushedUpdates = 0;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      // Path B.2: synthetic hidden-event rows are derived from freebusy, not
      // real events. Never push them back to Google.
      if (ev && (ev._syntheticFromFreeBusy || ev.syncStatus === 'synthetic')) continue;
      if (!ev || !ev.date || !ev.title) continue;
      var _gid = ev.googleEventId || (ev.sync && ev.sync.externalEventId);
      var _status = ev.syncStatus || (ev.sync && ev.sync.status) || '';
      // Dirty + already-synced → UPDATE (app-side edit needs to land on Google).
      if (_gid && _status === 'dirty') {
        try {
          var _gle = {
            id: ev.id || '', eventId: ev.id || '',
            title: ev.title || '',
            summary: ev.title || '',
            date: ev.date, endDate: ev.endDate || '',
            time: ev.time || '', startTime: ev.time || '',
            endTime: ev.endTime || '',
            venue: ev.venue || '',
            location: ev.location || ev.venue || '',
            description: ev.notes || '',
            type: ev.type,
            isAllDay: !!ev.isAllDay
          };
          var _upd = await update(_gid, _gle);
          // Single retry for transient errors (Google API has occasional
          // 500/502/503/429 spikes). Backoff small to avoid blocking sync.
          var _isTransient = !_upd.success && /^Update failed: (500|502|503|429)/.test(_upd.error || '');
          if (_isTransient) {
            console.log('[CalSync] Phase 1 UPDATE transient error for', ev.title, '(' + _upd.error + ') — retrying in 400ms');
            await new Promise(function(r) { setTimeout(r, 400); });
            _upd = await update(_gid, _gle);
          }
          if (_upd.success) {
            events[i].syncStatus = 'synced';
            events[i].lastSyncedAt = new Date().toISOString();
            events[i].sync = events[i].sync || {};
            events[i].sync.status = 'synced';
            events[i].sync.lastSyncedAt = events[i].lastSyncedAt;
            result.pushedUpdates++;
            dirty = true;
            console.log('[CalSync] Phase 1 UPDATE pushed:', ev.title, ev.date);
          } else if (_upd.status === 'orphan') {
            // Stored googleEventId no longer resolves on the band cal —
            // clear it and let CREATE run on the next iteration of Phase 1.
            console.log('[CalSync] Phase 1: orphan googleEventId for', ev.title, '— clearing for fresh CREATE');
            delete events[i].googleEventId;
            if (events[i].sync) delete events[i].sync.externalEventId;
            events[i].syncStatus = '';
            // Don't break — fall through to CREATE block below by re-setting status.
            _gid = null;
            _status = '';
          } else {
            // Stays dirty → next sync retries. Track in result so the toast
            // can surface "N updates failed — will retry" instead of swallowing.
            console.warn('[CalSync] Phase 1 UPDATE failed for', ev.title, ':', _upd.error, '— left dirty for next-sync retry');
            result.updateErrors = (result.updateErrors || 0) + 1;
          }
        } catch(e) {
          console.warn('[CalSync] Phase 1 UPDATE error for', ev.title, e.message);
          result.updateErrors = (result.updateErrors || 0) + 1;
        }
      }
      // Already synced + clean → skip
      var alreadySynced = (_gid && _status === 'synced');
      if (alreadySynced) continue;
      // Unsynced → CREATE
      try {
        var glEvent = {
          id: ev.id || '', eventId: ev.id || '',
          summary: ev.title, date: ev.date, startTime: ev.time || '19:00',
          endTime: ev.endTime || '',
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
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
      console.log('[CalSync] Phase 1: Pushed', result.pushed, 'events');
    }

    // ── PHASE 1.5: Push MY schedule blocks (Mode A only) ──
    // In Mode A the band calendar is the source of truth for availability.
    // Personal "Drew — busy" blocks must land on the shared calendar so the
    // whole band sees them; otherwise they live only in GrooveLinx's local
    // grid and never affect Google-side scheduling.
    result.blocksPushed = 0;
    result.blocksDeleted = 0;
    try {
      var _myKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
      // Prefer the band-member-stored name ("Drew") over the Google profile
      // name ("Andrew Merrill") — schedule blocks store ownerName as the
      // short band-member name.
      var _myName = '';
      if (_myKey && typeof bandMembers !== 'undefined' && bandMembers[_myKey] && bandMembers[_myKey].name) {
        _myName = bandMembers[_myKey].name;
      } else if (typeof getBandMemberName === 'function' && _myKey) {
        _myName = getBandMemberName(_myKey);
      } else if (typeof currentUserName !== 'undefined' && currentUserName) {
        _myName = currentUserName;
      }
      console.log('[CalSync] Phase 1.5: start — myKey =', _myKey, '| myName =', _myName);
      if (!_myKey) {
        console.log('[CalSync] Phase 1.5: SKIPPED — getCurrentMemberKey() returned null. Your signed-in email may not match any bandMembers entry. Check localStorage.deadcetera_current_user or bandMembers emails.');
      }
      if (_myKey && typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks && GLStore.saveScheduleBlock) {
        var blocks = await GLStore.getScheduleBlocks();
        console.log('[CalSync] Phase 1.5: scanning', blocks.length, 'schedule blocks');
        // Build a case-insensitive name-match fallback. Some older blocks stored
        // only ownerName ("Drew") without ownerKey — match those against the
        // current user's first/full name.
        var _myNameLower = (_myName || '').toLowerCase();
        var _myFirst = _myNameLower.split(' ')[0];
        console.log('[CalSync] Phase 1.5: match criteria — myKey=', _myKey, '| myNameLower=', _myNameLower, '| myFirst=', _myFirst);
        var _skipReasons = { bad: 0, notMine: 0, alreadySynced: 0 };
        var _notMineLogged = 0;
        for (var bi = 0; bi < blocks.length; bi++) {
          var blk = blocks[bi];
          if (!blk || !blk.blockId || !blk.startDate || !blk.endDate) { _skipReasons.bad++; continue; }
          // Accept ownerKey match OR name match (old blocks stored only
          // ownerName). Match against:
          // - the keyed identifier ("drew")
          // - the full bandMember name ("Drew")
          // - the first word
          var _blkOwnerLower = String(blk.ownerName || '').toLowerCase().trim();
          var _ownedByMe = (blk.ownerKey && blk.ownerKey === _myKey)
            || (blk.ownerName && (
                _blkOwnerLower === _myNameLower
                || _blkOwnerLower === (_myKey || '').toLowerCase()
                || _blkOwnerLower.split(' ')[0] === _myFirst
            ));
          if (!_ownedByMe) {
            if (_notMineLogged < 5) {
              console.log('[CalSync] Phase 1.5: skip (not mine):',
                'blockId=', blk.blockId,
                '| ownerKey=', JSON.stringify(blk.ownerKey),
                '| ownerName=', JSON.stringify(blk.ownerName),
                '| startDate=', blk.startDate,
                '| endDate=', blk.endDate,
                '| summary=', JSON.stringify(blk.summary));
              _notMineLogged++;
            }
            _skipReasons.notMine++;
            continue;
          }
          // Propagate local delete (tombstone)
          if (blk._deleted && blk.googleEventId) {
            try {
              var _del = await deleteConflictFromGoogle(blk.googleEventId, { calendarId: blk.calendarId || bandCalId });
              if (_del && _del.success) {
                await GLStore.deleteScheduleBlock(blk.blockId);
                result.blocksDeleted++;
                console.log('[CalSync] Phase 1.5: Deleted block from Google', blk.blockId);
              } else {
                console.warn('[CalSync] Phase 1.5: Google delete failed — leaving tombstone for retry:', blk.blockId, _del && _del.error);
              }
            } catch(e) { console.warn('[CalSync] Block delete failed:', blk.blockId, e.message); }
            continue;
          }
          // If already synced and NOT dirty (no UI edit since last sync), skip.
          // Dirty = updatedAt is newer than lastSyncedAt, or sync metadata says
          // so explicitly via needsSync flag.
          var _isDirty = !!blk.needsSync
            || (blk.updatedAt && blk.lastSyncedAt && new Date(blk.updatedAt) > new Date(blk.lastSyncedAt));
          if (blk.syncedToGoogle && blk.googleEventId && blk.calendarId === bandCalId && !_isDirty) {
            _skipReasons.alreadySynced++; continue;
          }
          try {
            var _display = (blk.ownerName || _myName || 'Member').trim();
            var _reason = (blk.summary || '').trim();
            // Compose GrooveLinx-style title: "Drew — busy" or "Drew — Out"
            var _summary = _display + ' \u2014 ' + (_reason || 'busy');
            // Migrate: if previously synced to a DIFFERENT calendar (e.g. the
            // legacy "Add to Google" button pushed to primary), clear the stale
            // link so we take the CREATE path on the band calendar. Best-effort
            // delete the old event from the old calendar afterwards.
            var _staleGid = null, _staleCal = null;
            if (blk.googleEventId && blk.calendarId && blk.calendarId !== bandCalId) {
              _staleGid = blk.googleEventId;
              _staleCal = blk.calendarId;
              blk.googleEventId = null;
              blk.syncedToGoogle = false;
              blk.calendarId = null;
            }
            var _res = await syncConflictToGoogle(blk, {
              calendarId: bandCalId,
              summary: _summary,
              visibility: 'default'
            });
            // Clean up the old personal-calendar event (non-fatal)
            if (_res && _res.success && _staleGid) {
              try {
                await deleteConflictFromGoogle(_staleGid, { calendarId: _staleCal });
                console.log('[CalSync] Phase 1.5: Cleaned stale event from', _staleCal);
              } catch(e) { /* non-fatal */ }
            }
            if (_res && _res.success) {
              blk.googleEventId = _res.googleEventId || blk.googleEventId;
              blk.calendarId = bandCalId;
              blk.syncedToGoogle = true;
              blk.lastSyncedAt = new Date().toISOString();
              blk.needsSync = false;
              // syncOnly: true — don't bump updatedAt or dirty-check loops forever
              await GLStore.saveScheduleBlock(blk, true);
              result.blocksPushed++;
              console.log('[CalSync] Phase 1.5: Pushed block', _summary, blk.startDate, '(update=' + !!blk.googleEventId + ')');
            } else {
              console.warn('[CalSync] Phase 1.5 push failed:', _summary, _res && _res.error);
              if (_res && (_res.status === 401 || _res.status === 403)) {
                result.needsReauth = true;
                break;
              }
            }
          } catch(e) { console.warn('[CalSync] Phase 1.5 error:', blk.blockId, e.message); }
        }
        console.log('[CalSync] Phase 1.5: done — pushed', result.blocksPushed, '| skipped:', _skipReasons);
      }
    } catch(e) { console.warn('[CalSync] Phase 1.5 outer error:', e && e.message); }

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
        console.log('[CalSync] Phase 2: fetch URL (before syncToken/pageToken):', url);
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
          // Phase 2 paginated fetch failure — partial sync risk. Log the
          // page number + how many events we got so far so the user / a
          // post-hoc diagnosis can see exactly what's missing.
          console.warn('[CalSync] Phase 2 page fetch failed:', res.status,
            '| collected so far:', googleEvents.length, 'events',
            '| pageToken:', pageToken ? pageToken.substring(0, 12) + '...' : '(first page)');
          result.error = 'Google API ' + res.status + ' on page fetch';
          result.partialFetch = googleEvents.length > 0;
          if (res.status === 401 || res.status === 403) result.needsReauth = true;
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
    // Diagnostic: enumerate what we actually got back so "event X is missing"
    // reports can be answered by checking the console rather than guessing.
    if (googleEvents.length) {
      var _titles = googleEvents.slice(0, 50).map(function(g) {
        var _d = (g.start && (g.start.date || g.start.dateTime)) || '(no-date)';
        return (g.status === 'cancelled' ? '[CANCELLED] ' : '') + (g.summary || '(no title)') + ' @ ' + _d;
      });
      console.log('[CalSync] Phase 2: Events returned by Google:', _titles);
      // Detail dump for cross-referencing when a specific event is missing from
      // the Google UI: creator, organizer, visibility, and our bandCalId so
      // we can tell "this event is actually on your personal calendar" apart
      // from "the UI is stale."
      googleEvents.slice(0, 50).forEach(function(g) {
        var _d = (g.start && (g.start.date || g.start.dateTime)) || '';
        console.log('[CalSync] E:',
          _d,
          '| title:', g.summary,
          '| creator:', (g.creator && g.creator.email) || '-',
          '| organizer:', (g.organizer && g.organizer.email) || '-',
          '| visibility:', g.visibility || 'default',
          '| status:', g.status);
      });
    }

    var dirty = false;
    for (var gi = 0; gi < googleEvents.length; gi++) {
      var gEv = googleEvents[gi];
      if (!gEv.id) continue;
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
        continue;
      }

      if (existIdx !== undefined && existIdx >= 0) {
        // ── Update: Google event matches existing Firebase event ──
        _reconcileEvent(events[existIdx], gEv);
        result.updated++;
        dirty = true;
      } else {
        // ── New: import from Google ──
        // Safety: check extendedProperties to see if this is a GrooveLinx-created event
        // that we somehow lost locally. If so, match by glEventId before importing as new.
        var _extProp = gEv.extendedProperties && gEv.extendedProperties.private;
        // glBlockId: incoming event is a mirror of someone's schedule_block.
        // If it's MY block coming back from the band calendar, re-link the block
        // and skip importing as a calendar_event (prevents duplicate grid render).
        // If it belongs to another member, fall through to normal import so the
        // unavailability classifier picks it up via event title ("X — busy").
        var _glBlockId = _extProp && _extProp.glBlockId;
        var _skipAsBlockLink = false;
        if (_glBlockId && typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks && GLStore.saveScheduleBlock) {
          try {
            var _myKey2 = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
            var _blks = await GLStore.getScheduleBlocks();
            var _mine = _blks.find(function(b) { return b.blockId === _glBlockId && b.ownerKey && b.ownerKey === _myKey2; });
            if (_mine) {
              if (!_mine.googleEventId || _mine.googleEventId !== gEv.id) {
                _mine.googleEventId = gEv.id;
                _mine.calendarId = bandCalId;
                _mine.syncedToGoogle = true;
                _mine.lastSyncedAt = new Date().toISOString();
                await GLStore.saveScheduleBlock(_mine, true);
                console.log('[CalSync] Phase 2: Re-linked block', _mine.blockId, '→', gEv.id);
              }
              _skipAsBlockLink = true; // my own block — don't also import as calendar_event
            }
          } catch(e) { console.warn('[CalSync] Phase 2 block re-link error:', e && e.message); }
        }
        if (_skipAsBlockLink) continue;
        var _glId = _extProp && _extProp.glEventId;
        if (_glId) {
          var _localMatch = events.findIndex(function(e) { return e.id === _glId; });
          if (_localMatch >= 0) {
            var _local = events[_localMatch];
            var _localGid = _local.googleEventId || (_local.sync && _local.sync.externalEventId);
            if (_localGid && _localGid !== gEv.id) {
              // Local is already linked to a DIFFERENT Google event. This
              // incoming one is a duplicate orphan from an earlier race.
              // Delete it rather than overwriting the good link (that was
              // the bug that kept creating duplicates).
              console.log('[CalSync] Dedupe: orphan Google event', gEv.id,
                          '— local already linked to', _localGid);
              remove(gEv.id).catch(function (e) {
                console.warn('[CalSync] Orphan delete failed:', gEv.id, e && e.message);
              });
              result.deleted++;
              dirty = true;
              continue;
            }
            // Re-link: local event exists but lost its googleEventId
            events[_localMatch].googleEventId = gEv.id;
            events[_localMatch].sync = events[_localMatch].sync || {};
            events[_localMatch].sync.externalEventId = gEv.id;
            events[_localMatch].sync.status = 'synced';
            _reconcileEvent(events[_localMatch], gEv);
            eventsByGoogleId[gEv.id] = _localMatch;
            result.updated++;
            dirty = true;
            console.log('[CalSync] Re-linked:', gEv.summary, '→ local id:', _glId);
            continue; // skip import — it's a re-link
          }
        }
        var newEv = _importGoogleEvent(gEv, bandCalId);
        events.push(newEv);
        eventsByGoogleId[gEv.id] = events.length - 1;
        result.pulled++;
        dirty = true;
        console.log('[CalSync] Inbound NEW:', newEv.title, newEv.date);
      }
    }

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

    // ── Phase 2.4: Dedupe by googleEventId ──
    // Past sync races + the recent band-cal-source rule retag created cases
    // where two calendar_events rows pointed at the same googleEventId — the
    // red-day hover then showed "Brian — MoonShadow Tavern" twice. Score
    // each row by metadata richness, keep the highest, drop the rest.
    var _gidGroups = {};
    events.forEach(function(_e, _idx) {
      if (!_e || _e._syntheticFromFreeBusy) return;
      var _gid = _e.googleEventId || (_e.sync && _e.sync.externalEventId);
      if (!_gid) return;
      if (!_gidGroups[_gid]) _gidGroups[_gid] = [];
      _gidGroups[_gid].push(_idx);
    });
    var _scoreEv = function(e) {
      return (e.time ? 1 : 0) + (e.endTime ? 1 : 0) + (e.updated_at ? 1 : 0)
        + (e.lastSyncedAt ? 1 : 0) + (e.venue ? 1 : 0) + (e.location ? 1 : 0);
    };
    var _toDrop = [];
    Object.keys(_gidGroups).forEach(function(gid) {
      var idxs = _gidGroups[gid];
      if (idxs.length < 2) return;
      // Pick the keeper: highest score; ties go to the lowest index (oldest).
      var keeper = idxs[0];
      var keeperScore = _scoreEv(events[keeper]);
      for (var k = 1; k < idxs.length; k++) {
        var s = _scoreEv(events[idxs[k]]);
        if (s > keeperScore) { keeper = idxs[k]; keeperScore = s; }
      }
      idxs.forEach(function(i) { if (i !== keeper) _toDrop.push(i); });
    });
    if (_toDrop.length) {
      _toDrop.sort(function(a, b) { return b - a; });
      _toDrop.forEach(function(i) { events.splice(i, 1); });
      console.log('[CalSync] Phase 2.4 dedupe: removed', _toDrop.length, 'duplicate calendar_events rows by googleEventId');
      dirty = true;
      eventsByGoogleId = {};
      events.forEach(function(e, idx) {
        if (e.googleEventId) eventsByGoogleId[e.googleEventId] = idx;
        if (e.sync && e.sync.externalEventId) eventsByGoogleId[e.sync.externalEventId] = idx;
      });
    }

    // ── Phase 2.5: Zombie sweep — DISABLED 2026-04-26 ──
    // The sweep was nuking real events whose googleEventId pointed to an
    // orphan/personal-cal copy (legacy auto-attendee replicas). Phase 1's
    // new dirty UPDATE flow could also create fresh events mid-sync that
    // weren't in Phase 2's events.list response yet, causing the same
    // sweep to delete them seconds after creation. Real prod data loss
    // (420 Festival gig).
    //
    // Until we can rewrite this with a recently-touched-grace-period and
    // explicit cancelled-status check from Google's response, leave the
    // sweep OFF. Stale googleEventIds in calendar_events are harmless
    // (the import path dedupes by googleEventId on next fetch). Real
    // event loss is not.
    if (false && !useSyncToken) {
      // intentionally dead — see comment above
    }

    // Save all changes
    if (dirty) {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
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

    // ── Path B: Hidden-event safety net ──
    // Detects busy time on the shared band calendar that has no visible event.
    // This catches events created with Private/Default visibility that get
    // hidden from the events.list API but still show as busy in freebusy.
    var _hiddenRanges = null;
    if (!result.needsReauth) {
      _hiddenRanges = await _runHiddenEventCheck(bandCalId);
    }

    // ── Path B.2: Materialize hidden ranges as synthetic calendar_events ──
    // The banner alone tells you WHICH dates are ghost-busy; writing them as
    // synthetic events makes the grid actually render them as blocked time so
    // scheduling UIs flag the conflict. Tagged _syntheticFromFreeBusy so
    // Phase 1 doesn't push them back to Google.
    try {
      var _synthKeys = {};
      var _synthDirty = false;
      var _toDateStr = function(d) {
        return d.getFullYear() + '-'
          + String(d.getMonth() + 1).padStart(2, '0') + '-'
          + String(d.getDate()).padStart(2, '0');
      };
      var _toTimeStr = function(d) {
        return String(d.getHours()).padStart(2, '0') + ':'
          + String(d.getMinutes()).padStart(2, '0');
      };
      // Path B.2 #37: if the hidden-event check failed (returned null), do
      // NOT clean up existing synthetics — that would wipe the grid every
      // time freebusy 401s. Skip the entire write/cleanup phase and preserve
      // last-known state until next successful check.
      var _checkFailed = (_hiddenRanges === null);
      // Helper: update sync state without overwriting existing fields.
      var _updateMissStreak = async function(val) {
        try {
          var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
          if (db && typeof bandPath === 'function') {
            await db.ref(bandPath('calendar_sync_state')).update({ hiddenCheckMissStreak: val });
          }
        } catch(_e) { /* non-fatal */ }
      };
      if (_checkFailed) {
        // Bump a counter — if freebusy has failed N consecutive syncs, the
        // synthetics are likely stale (event was deleted and we have no way
        // to know). After 3 misses, clear them to avoid permanent ghosts.
        var _miss = (syncState.hiddenCheckMissStreak || 0) + 1;
        if (_miss >= 3) {
          console.warn('[CalSync] Path B.2: hidden-event check failed', _miss, 'syncs in a row — clearing stale synthetics to avoid permanent ghosts');
          for (var _ci = events.length - 1; _ci >= 0; _ci--) {
            if (events[_ci] && events[_ci]._syntheticFromFreeBusy) {
              events.splice(_ci, 1);
              _synthDirty = true;
            }
          }
          await _updateMissStreak(0);
        } else {
          console.warn('[CalSync] Path B.2: hidden-event check failed (streak ' + _miss + '/3); preserving existing synthetic blocks until next successful check');
          await _updateMissStreak(_miss);
        }
      } else {
        // Reset streak on success
        if (syncState.hiddenCheckMissStreak) {
          await _updateMissStreak(0);
        }
      (_hiddenRanges || []).forEach(function(h) {
        var s = new Date(h.start);
        var e = new Date(h.end);
        var durMs = e.getTime() - s.getTime();
        var isAllDay = durMs >= 24 * 3600 * 1000 - 60000;
        var baseKey = 'synth_hidden_' + h.start + '_' + h.end;
        if (isAllDay) {
          // Materialize one row per day in the span so each calendar cell
          // renders the blocked state.
          var _d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          var _endExcl = new Date(e.getFullYear(), e.getMonth(), e.getDate());
          // If end aligns exactly on midnight, it's exclusive (Google all-day
          // convention). If not, include the end day too.
          if (e.getHours() !== 0 || e.getMinutes() !== 0) _endExcl.setDate(_endExcl.getDate() + 1);
          while (_d < _endExcl) {
            var dStr = _toDateStr(_d);
            var key = baseKey + '_' + dStr;
            _synthKeys[key] = true;
            var idx = events.findIndex(function(ex) { return ex.id === key; });
            var evObj = {
              id: key, eventId: key,
              title: 'Busy (hidden event)',
              date: dStr, time: '', endTime: '', endDate: '',
              isAllDay: true,
              type: 'unavailable',
              notes: 'Hidden event on shared band calendar. Visibility is Private or Default \u2014 ask band members to check their account default visibility and set it to Public to see details.',
              _syntheticFromFreeBusy: true,
              _hiddenRangeKey: key,
              syncStatus: 'synthetic'
            };
            if (idx >= 0) { events[idx] = evObj; } else { events.push(evObj); _synthDirty = true; }
            _d.setDate(_d.getDate() + 1);
          }
        } else {
          // Single-day OR midnight-crossing timed range.
          // For midnight-crossing events (e.g., 9 PM Sat → 1 AM Sun), write
          // ONE synthetic per affected day so each day's grid cell shows the
          // block. Without this, scheduling Sunday morning would look free
          // even though members were busy until 1 AM. Real correctness bug.
          var sameDay = s.getFullYear() === e.getFullYear()
            && s.getMonth() === e.getMonth()
            && s.getDate() === e.getDate();
          if (sameDay) {
            var dStr2 = _toDateStr(s);
            var key2 = baseKey;
            _synthKeys[key2] = true;
            var idx2 = events.findIndex(function(ex) { return ex.id === key2; });
            var evObj2 = {
              id: key2, eventId: key2,
              title: 'Busy (hidden event)',
              date: dStr2,
              time: _toTimeStr(s),
              endTime: _toTimeStr(e),
              endDate: '',
              isAllDay: false,
              type: 'unavailable',
              notes: 'Hidden event on shared band calendar. Visibility is Private or Default \u2014 ask band members to check their account default visibility and set it to Public to see details.',
              _syntheticFromFreeBusy: true,
              _hiddenRangeKey: key2,
              syncStatus: 'synthetic'
            };
            if (idx2 >= 0) { events[idx2] = evObj2; } else { events.push(evObj2); _synthDirty = true; }
          } else {
            // Multi-day timed: walk each day in the span. First day uses the
            // real start time + 23:59. Middle days are 00:00–23:59 (effectively
            // all-day). Last day uses 00:00 + the real end time.
            var _walkD = new Date(s.getFullYear(), s.getMonth(), s.getDate());
            var _lastD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
            while (_walkD <= _lastD) {
              var _isFirst = _walkD.getTime() === new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
              var _isLast = _walkD.getTime() === _lastD.getTime();
              var _segStart = _isFirst ? _toTimeStr(s) : '00:00';
              var _segEnd = _isLast ? _toTimeStr(e) : '23:59';
              // Skip degenerate end-on-midnight last day — Google freebusy
              // ranges that end exactly at 00:00 on the next day are
              // equivalent to "ends at end of previous day"; don't write a
              // 0-min block for the trailing day.
              if (_isLast && _segEnd === '00:00') break;
              var dStrN = _toDateStr(_walkD);
              var keyN = baseKey + '_' + dStrN;
              _synthKeys[keyN] = true;
              var idxN = events.findIndex(function(ex) { return ex.id === keyN; });
              var evObjN = {
                id: keyN, eventId: keyN,
                title: 'Busy (hidden event)',
                date: dStrN,
                time: _segStart,
                endTime: _segEnd,
                endDate: '',
                isAllDay: (_segStart === '00:00' && _segEnd === '23:59'),
                type: 'unavailable',
                notes: 'Hidden event on shared band calendar. Visibility is Private or Default \u2014 ask band members to check their account default visibility and set it to Public to see details.',
                _syntheticFromFreeBusy: true,
                _hiddenRangeKey: keyN,
                syncStatus: 'synthetic'
              };
              if (idxN >= 0) { events[idxN] = evObjN; } else { events.push(evObjN); _synthDirty = true; }
              _walkD.setDate(_walkD.getDate() + 1);
            }
          }
        }
      });
      // Remove stale synthetic rows that are no longer in the freebusy output
      for (var _si = events.length - 1; _si >= 0; _si--) {
        var _sev = events[_si];
        if (_sev && _sev._syntheticFromFreeBusy && !_synthKeys[_sev._hiddenRangeKey]) {
          events.splice(_si, 1);
          _synthDirty = true;
        }
      }
      if (_synthDirty) {
        await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
        console.log('[CalSync] Path B.2: Wrote', Object.keys(_synthKeys).length,
          'synthetic hidden-event rows (stale removed)');
      }
      } // end else (check succeeded)
    } catch(e) {
      console.warn('[CalSync] Path B.2 synthetic-write error:', e && e.message);
    }

    // Always record the sync result timestamp so UI can show an accurate
    // "Last synced" regardless of whether a new syncToken was issued.
    try {
      var _prev = await _loadSyncState();
      await _saveSyncState({
        syncToken: _prev.syncToken || null,
        lastFullSync: _prev.lastFullSync || null,
        lastIncrementalSync: _prev.lastIncrementalSync || null,
        lastSyncAt: new Date().toISOString(),
        lastSyncResult: {
          pushed: result.pushed || 0,
          pulled: result.pulled || 0,
          updated: result.updated || 0,
          deleted: result.deleted || 0,
          blocksPushed: result.blocksPushed || 0,
          blocksDeleted: result.blocksDeleted || 0,
          error: result.error || null,
          needsReauth: !!result.needsReauth,
          hiddenCount: (_hiddenRanges && _hiddenRanges.length) || 0,
          hiddenRanges: (_hiddenRanges || []).slice(0, 50),
          hiddenCheckFailed: (_hiddenRanges === null)
        },
        syncVersion: _prev.syncVersion || 2
      });
      if (_hiddenRanges) result.hiddenRanges = _hiddenRanges;
    } catch(e) { console.warn('[CalSync] Failed to record sync result:', e && e.message); }

    // Path D #6: stamp my per-member lastSyncAt so other members can see
    // whether my device is up to date. Firebase-only; no push to other devices.
    try {
      var _db3 = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      var _myKeyStamp = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey)
        ? FeedActionState.getMyMemberKey() : null;
      if (_db3 && _myKeyStamp && typeof bandPath === 'function' && !result.needsReauth) {
        await _db3.ref(bandPath('google_connections/' + _myKeyStamp + '/lastSyncAt'))
          .set(new Date().toISOString());
      }
    } catch(e) { /* non-fatal */ }
    // Track first sync success
    if ((result.pushed > 0 || result.pulled > 0) && typeof GLUXTracker !== 'undefined' && GLUXTracker._logEvent) {
      if (!localStorage.getItem('gl_cal_first_sync')) {
        localStorage.setItem('gl_cal_first_sync', '1');
        GLUXTracker._logEvent('cal_first_sync_success', { pushed: result.pushed, pulled: result.pulled });
      }
    }
    return result;
  }

  // Public: read last-sync metadata for UI rendering
  async function getSyncState() {
    return await _loadSyncState();
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

        // Trust GrooveLinx-stamped glType, else use title classifier
        var _epPriv2 = (gEv.extendedProperties && gEv.extendedProperties.private) || {};
        var _glType2 = (_epPriv2.glType || '').toLowerCase();
        var _validGl2 = { gig: 1, rehearsal: 1, meeting: 1, unavailable: 1, other: 1 };
        var inferredType = _validGl2[_glType2] ? _glType2 : _classifyEventType(summary);

        // Mode A band-cal-source rule: un-keyworded band-cal events become
        // member-attributed unavailability so they actually block the day.
        // Skip for GrooveLinx-stamped events.
        var _creatorEmail2 = (gEv.creator && gEv.creator.email) || (gEv.organizer && gEv.organizer.email) || '';
        var _isGlStamped2 = _epPriv2.groovelinx === 'true';
        // ── Unavailability detection ──
        var _unavail = (inferredType !== 'rehearsal' && inferredType !== 'gig' && inferredType !== 'meeting') ? _detectUnavailability(summary) : { isUnavail: false };
        if (inferredType === 'other' && bandCalId && !_unavail.isUnavail && !_isGlStamped2) {
          var _creatorKey2 = _memberKeyFromEmail(_creatorEmail2);
          if (_creatorKey2) {
            inferredType = 'unavailable';
            _unavail = { isUnavail: true, scope: 'member', members: [_creatorKey2] };
          }
        }
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
        await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(allEvents));
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

  async function syncConflictToGoogle(block, opts) {
    if (!hasCalendarScope() || !block) return { success: false, error: 'no scope' };
    var startDate = block.startDate;
    var endDate = block.endDate;
    if (!startDate || !endDate) return { success: false, error: 'no dates' };
    opts = opts || {};
    // All-day event: use date (not dateTime), end is exclusive in Google API
    var endExclusive = new Date(endDate + 'T00:00:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    var endStr = endExclusive.getFullYear() + '-' + String(endExclusive.getMonth() + 1).padStart(2, '0') + '-' + String(endExclusive.getDate()).padStart(2, '0');

    var body = {
      summary: opts.summary || 'Busy',
      description: 'Created by GrooveLinx (band scheduling)',
      start: { date: startDate },
      end: { date: endStr },
      visibility: opts.visibility || 'private',
      transparency: 'opaque',
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: { groovelinxConflictId: block.blockId || '', glBlockId: block.blockId || '' } }
    };

    try {
      // Check for existing event to prevent duplicates
      if (block.googleEventId) {
        return await updateConflictInGoogle(block, opts);
      }
      // BUG FIX: callers (e.g., _calSyncConflictToGoogle, _calSyncExistingConflict)
      // sometimes invoke this without opts.calendarId. The previous code then
      // dropped the calendarId param, which made the worker proxy default to
      // 'primary' and silently posted the block to the user's PERSONAL Google
      // calendar instead of the shared band cal. Always self-resolve via
      // _getBandCalendarId() and refuse to push if the band cal is missing.
      var _calId = opts.calendarId;
      if (!_calId || !_isGroupCalendarId(_calId)) {
        _calId = await _getBandCalendarId();
      }
      if (!_calId || !_isGroupCalendarId(_calId)) {
        console.warn('[CalSync] syncConflictToGoogle aborted — no group band calendar resolved (got:', _calId, ')');
        return { success: false, error: 'No band calendar configured', status: 'no_band_cal' };
      }
      console.log('[CalSync] syncConflictToGoogle POST URL =', WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(_calId));
      var _url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(_calId);
      var res = await fetch(_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        console.warn('[CalSync] Conflict sync failed:', res.status);
        return { success: false, error: 'Google returned ' + res.status, status: res.status };
      }
      var data = await res.json();
      return { success: true, googleEventId: data.id, htmlLink: data.htmlLink || '', calendarId: _calId };
    } catch (err) {
      console.warn('[CalSync] Conflict sync error:', err);
      return { success: false, error: err.message };
    }
  }

  async function updateConflictInGoogle(block, opts) {
    if (!hasCalendarScope() || !block || !block.googleEventId) return { success: false };
    opts = opts || {};
    var endExclusive = new Date(block.endDate + 'T00:00:00');
    endExclusive.setDate(endExclusive.getDate() + 1);
    var endStr = endExclusive.getFullYear() + '-' + String(endExclusive.getMonth() + 1).padStart(2, '0') + '-' + String(endExclusive.getDate()).padStart(2, '0');

    var body = {
      summary: opts.summary || 'Busy',
      description: 'Created by GrooveLinx (band scheduling)',
      start: { date: block.startDate },
      end: { date: endStr },
      visibility: opts.visibility || 'private',
      transparency: 'opaque'
    };
    try {
      // Same bug-fix as syncConflictToGoogle: never trust opts/block to have
      // a valid group cal ID. Resolve via _getBandCalendarId() so we never
      // accidentally PATCH against the user's personal calendar.
      var _calId = opts.calendarId;
      if (!_calId || !_isGroupCalendarId(_calId)) {
        if (block.calendarId && _isGroupCalendarId(block.calendarId)) {
          _calId = block.calendarId;
        } else {
          _calId = await _getBandCalendarId();
        }
      }
      if (!_calId || !_isGroupCalendarId(_calId)) {
        console.warn('[CalSync] updateConflictInGoogle aborted — no group band calendar resolved');
        return { success: false, error: 'No band calendar configured' };
      }
      var _url = WORKER_BASE + '/calendar/events/' + encodeURIComponent(block.googleEventId)
        + '?calendarId=' + encodeURIComponent(_calId);
      var res = await fetch(_url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify(body)
      });
      if (!res.ok) return { success: false, error: 'Update failed: ' + res.status, status: res.status };
      return { success: true, googleEventId: block.googleEventId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function deleteConflictFromGoogle(googleEventId, opts) {
    if (!hasCalendarScope() || !googleEventId) return { success: false };
    opts = opts || {};
    try {
      // Same routing-bug guard as syncConflictToGoogle/updateConflictInGoogle:
      // never let opts default to undefined. Validate the calendarId is a
      // group cal; if not, resolve via _getBandCalendarId(). Refuses to
      // DELETE without a valid group cal — better to fail loudly than
      // silently delete from the user's primary calendar.
      var _calId = opts.calendarId;
      if (!_calId || !_isGroupCalendarId(_calId)) {
        _calId = await _getBandCalendarId();
      }
      if (!_calId || !_isGroupCalendarId(_calId)) {
        console.warn('[CalSync] deleteConflictFromGoogle aborted — no group band calendar resolved');
        return { success: false, error: 'No band calendar configured' };
      }
      var _url = WORKER_BASE + '/calendar/events/' + encodeURIComponent(googleEventId)
        + '?calendarId=' + encodeURIComponent(_calId);
      var res = await fetch(_url, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.status === 204 || res.status === 410 || res.status === 404) return { success: true };
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
    // Band-level setting (shared across all members) — source of truth.
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('band_calendar/calendarId')).once('value');
        var _bandLevel = snap.val();
        if (_bandLevel) {
          if (!_isGroupCalendarId(_bandLevel)) {
            console.warn('[CalSync] band-level calendarId is NOT a group calendar — refusing to use it:', _bandLevel);
            return null;
          }
          return _bandLevel;
        }
      }
    } catch(e) {}
    // User-level fallback — ONLY accept group-calendar IDs so we never silently
    // write band events to someone's personal calendar (bug where Brian's device
    // pushed 6/20 and 6/28 gigs to brian@hrestoration.com instead of DeadCetera).
    var settings = await getAvailabilitySettings();
    if (settings && settings.bandCalendarId) {
      if (!_isGroupCalendarId(settings.bandCalendarId)) {
        console.warn('[CalSync] user-level bandCalendarId is a personal calendar — refusing fallback. Band calendar must be configured at band level:', settings.bandCalendarId);
        return null;
      }
      return settings.bandCalendarId;
    }
    return null;
  }

  function _isGroupCalendarId(id) {
    if (!id || typeof id !== 'string') return false;
    // Google group calendars end in @group.calendar.google.com
    // Personal gmail accounts or 'primary' are never valid band calendars.
    if (id === 'primary') return false;
    if (id.indexOf('@group.calendar.google.com') > -1) return true;
    return false;
  }

  // ── Account-default-visibility detector (UX idea #1) ──────────────────────
  // Creates a tiny throwaway event on the BAND calendar with visibility:
  // 'default', reads it back, and returns the visibility Google actually
  // assigned (which reveals the user's account-level default). Result cached
  // in localStorage for 7 days so we don't repeatedly create test events.
  // Returns: { visibility: 'public'|'private'|'default'|'unknown', cached: bool, ts: ISO }
  async function detectAccountDefaultVisibility(opts) {
    opts = opts || {};
    var cacheKey = 'gl_cal_default_vis_' + (currentUserEmail || 'unknown');
    var ttlMs = 7 * 24 * 60 * 60 * 1000;
    if (!opts.force) {
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && cached.ts && (Date.now() - new Date(cached.ts).getTime()) < ttlMs) {
          return Object.assign({}, cached, { cached: true });
        }
      } catch(e) {}
    }
    var result = { visibility: 'unknown', cached: false, ts: new Date().toISOString() };
    if (!hasCalendarScope() || !accessToken) {
      result.error = 'no_scope';
      return result;
    }
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) {
      result.error = 'no_band_cal';
      return result;
    }
    try {
      // Far-future date to avoid showing in any sane calendar view if it
      // somehow doesn't get cleaned up. 2099 = will be deleted by then.
      var farFuture = '2099-12-31';
      var body = {
        summary: '[GrooveLinx visibility test — safe to delete]',
        description: 'Auto-created by GrooveLinx to detect your account default visibility. This event is deleted immediately after the check.',
        start: { date: farFuture },
        end: { date: '2100-01-01' },
        visibility: 'default',
        transparency: 'transparent',
        extendedProperties: { private: { glVisibilityProbe: '1' } }
      };
      var createUrl = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId);
      var createRes = await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
        body: JSON.stringify(body)
      });
      if (!createRes.ok) {
        result.error = 'create_failed_' + createRes.status;
        return result;
      }
      var created = await createRes.json();
      // Read it back to see what visibility Google actually assigned. If user
      // account default is Private, Google rewrites visibility:'default' to
      // visibility:'private' on save.
      var readUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(created.id) + '?calendarId=' + encodeURIComponent(bandCalId);
      var readRes = await fetch(readUrl, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (readRes.ok) {
        var readBack = await readRes.json();
        result.visibility = readBack.visibility || 'default';
      } else {
        result.error = 'read_failed_' + readRes.status;
      }
      // Always delete the probe event, even if read failed.
      try {
        await fetch(WORKER_BASE + '/calendar/events/' + encodeURIComponent(created.id) + '?calendarId=' + encodeURIComponent(bandCalId), {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
      } catch(_e) { /* best-effort cleanup */ }
      try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch(_e) {}
      return result;
    } catch (err) {
      result.error = 'exception: ' + (err && err.message);
      return result;
    }
  }

  // ── Calendar Health Check (UX idea #2/#3) ─────────────────────────────────
  // Returns a structured result with one entry per check the Calendar Health
  // Card and "Run diagnostics" troubleshooter both render. Each entry:
  // { id, label, status: 'ok'|'warn'|'error'|'unknown', message, fixAction? }
  async function runCalendarHealthCheck(opts) {
    opts = opts || {};
    var checks = [];
    var hasToken = !!accessToken && hasCalendarScope();
    checks.push({
      id: 'signin',
      label: 'Signed in to Google',
      status: hasToken ? 'ok' : 'error',
      message: hasToken ? 'Calendar scope granted' : 'Sign in or reconnect Google Calendar',
      fixAction: hasToken ? null : '_calConnectGoogle()'
    });
    if (!hasToken) return { checks: checks, verdict: 'error' };

    var bandCalId = await _getBandCalendarId();
    var rawBandLevel = null;
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('band_calendar/calendarId')).once('value');
        rawBandLevel = snap.val();
      }
    } catch(_e) {}
    if (!bandCalId) {
      checks.push({
        id: 'bandcal',
        label: 'Band calendar configured',
        status: 'error',
        message: rawBandLevel
          ? 'Stored cal ID is not a group calendar ("' + rawBandLevel + '") \u2014 events would land on a personal calendar.'
          : 'No band calendar selected yet.',
        fixAction: '_calShowAvailabilitySettings()'
      });
      return { checks: checks, verdict: 'error' };
    }
    checks.push({
      id: 'bandcal',
      label: 'Band calendar configured',
      status: 'ok',
      message: 'Group calendar selected'
    });

    // Write access (HEAD on the cal — fast)
    var canWrite = false;
    try { canWrite = await canWriteBandCalendar(); } catch(_e) {}
    checks.push({
      id: 'write',
      label: 'Write access to band calendar',
      status: canWrite ? 'ok' : 'error',
      message: canWrite
        ? '"Make changes to events" granted'
        : 'Read-only access \u2014 ask the calendar owner to grant "Make changes to events".',
      fixAction: canWrite ? null : null
    });

    // Visibility default
    var vis = await detectAccountDefaultVisibility(opts);
    if (vis.error) {
      checks.push({
        id: 'visibility',
        label: 'Default event visibility',
        status: 'unknown',
        message: 'Could not check (' + vis.error + ')'
      });
    } else if (vis.visibility === 'private' || vis.visibility === 'confidential') {
      checks.push({
        id: 'visibility',
        label: 'Default event visibility',
        status: 'warn',
        message: 'Set to PRIVATE \u2014 events you create will be hidden from GrooveLinx.',
        fixAction: '_calShowVisibilityHelp()'
      });
    } else if (vis.visibility === 'public') {
      checks.push({
        id: 'visibility',
        label: 'Default event visibility',
        status: 'ok',
        message: 'Set to Public — events visible to band'
      });
    } else {
      // 'default' = inherits from calendar default. For a group cal that
      // typically resolves to public, but it's worth flagging so the user
      // can confirm.
      checks.push({
        id: 'visibility',
        label: 'Default event visibility',
        status: 'ok',
        message: 'Default (inherits calendar setting)'
      });
    }

    // Last sync recency
    try {
      var st = await _loadSyncState();
      if (!st.lastSyncAt) {
        checks.push({
          id: 'lastsync',
          label: 'Last sync',
          status: 'warn',
          message: 'Never synced \u2014 try Sync Calendars to verify everything works.',
          fixAction: '_calSyncNow()'
        });
      } else {
        var ageMs = Date.now() - new Date(st.lastSyncAt).getTime();
        var ageHrs = Math.floor(ageMs / 3600000);
        if (ageHrs >= 24 * 7) {
          checks.push({
            id: 'lastsync',
            label: 'Last sync',
            status: 'warn',
            message: 'Over a week ago \u2014 your changes may not have reached the band.',
            fixAction: '_calSyncNow()'
          });
        } else {
          var label = ageHrs < 1 ? 'just now' : (ageHrs < 24 ? ageHrs + 'h ago' : Math.floor(ageHrs / 24) + 'd ago');
          checks.push({
            id: 'lastsync',
            label: 'Last sync',
            status: 'ok',
            message: label
          });
        }
      }
    } catch(_e) {}

    // Verdict
    var hasError = checks.some(function(c) { return c.status === 'error'; });
    var hasWarn = checks.some(function(c) { return c.status === 'warn'; });
    return {
      checks: checks,
      verdict: hasError ? 'error' : (hasWarn ? 'warn' : 'ok'),
      bandCalId: bandCalId,
      visibility: vis
    };
  }

  // ── Calendar pollution audit ──────────────────────────────────────────────
  // Returns a structured report classifying:
  //  - "zombie": local calendar_events with a googleEventId that no longer
  //    resolves on Google (404). Safe to delete locally; no Google call.
  //  - "personalPollution": events on the band Google cal that look like
  //    personal stuff (private/default visibility + non-band-keyword title +
  //    creator is a band member). Likely accumulated from past misconfig.
  //  - "stale": past-dated events older than 60 days (informational only).
  // Read-only — never deletes anything. UI reviews + approves before any
  // destructive action.
  async function auditCalendarPollution(opts) {
    opts = opts || {};
    var report = { zombies: [], personalPollution: [], stale: [], normalCount: 0, error: null };
    if (!hasCalendarScope()) { report.error = 'no_scope'; return report; }
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) { report.error = 'no_band_cal'; return report; }

    // Band keyword patterns — anything matching is probably a real band event.
    // Expanded 2026-04-26 to match _classifyEventType so the audit doesn't
    // propose deletion of events the live classifier (correctly) tags as gigs.
    var bandPatterns = [
      /deadcetera/i, /\brehears/i, /\bpractice\b/i, /\bgig\b/i, /\bshow\b/i,
      /\bconcert\b/i, /\bsoundcheck\b/i, /\bvenue\b/i,
      /\bband\b/i, /\bopen mic\b/i, /\bjam\b/i, /\bfest\b/i, /\bfestival\b/i,
      /\blive at\b/i, /\bplaying\b/i, /\bopening for\b/i, /\bset @/i,
      /\balbum release/i, /\brecording session/i, /fb\/event\//i,
      /\bband meeting\b/i, /\bband sync\b/i, /\bgear talk\b/i, /\bset planning\b/i
    ];
    function looksLikeBandEvent(title, description) {
      var blob = (title || '') + ' ' + (description || '');
      if (!blob.trim()) return false;
      return bandPatterns.some(function(p) { return p.test(blob); });
    }

    // Build set of known band-member emails so we can flag events created by
    // band members but NOT titled like a band event.
    var bandEmails = await _getBandEmails();
    var bandEmailSet = {};
    (bandEmails || []).forEach(function(em) { bandEmailSet[em.toLowerCase()] = true; });
    // Track the current user's email — Google permissions only allow each
    // user to delete events THEY created (even on a shared cal with "make
    // changes to events"). Cross-user deletes return 403. So only propose
    // deletion of events the running user owns; everything else is shown
    // as informational so the band can chase the right person.
    var myEmail = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.toLowerCase() : '';
    report.othersPollution = [];

    // ── 1. Local zombies — events in calendar_events whose Google id is gone ──
    var localEvents = [];
    try {
      localEvents = (typeof toArray === 'function')
        ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
        : [];
    } catch(e) { /* fall through with empty */ }

    for (var i = 0; i < localEvents.length; i++) {
      var ev = localEvents[i];
      if (!ev || ev._syntheticFromFreeBusy) continue;
      var gid = ev.googleEventId || (ev.sync && ev.sync.externalEventId);
      if (!gid) continue;
      try {
        var url = WORKER_BASE + '/calendar/events/' + encodeURIComponent(gid)
          + '?calendarId=' + encodeURIComponent(bandCalId);
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (res.status === 404 || res.status === 410) {
          report.zombies.push({
            id: ev.id,
            title: ev.title || '(untitled)',
            date: ev.date || '',
            googleEventId: gid
          });
        }
      } catch(e) { /* network — ignore for this run */ }
    }

    // ── 2. Personal pollution + stale — full scan of band Google cal ──
    try {
      var now = new Date();
      var min = new Date(now.getFullYear() - 1, 0, 1).toISOString();
      var max = new Date(now.getFullYear() + 1, 11, 31).toISOString();
      var pageToken = null;
      var pages = 0;
      var staleCutoffMs = now.getTime() - (60 * 24 * 60 * 60 * 1000);
      do {
        pages++;
        if (pages > 20) break;
        var listUrl = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId)
          + '&timeMin=' + encodeURIComponent(min)
          + '&timeMax=' + encodeURIComponent(max)
          + '&maxResults=250';
        if (pageToken) listUrl += '&pageToken=' + encodeURIComponent(pageToken);
        var listRes = await fetch(listUrl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (!listRes.ok) { report.error = 'list_failed_' + listRes.status; break; }
        var data = await listRes.json();
        (data.items || []).forEach(function(g) {
          if (!g || g.status === 'cancelled') return;
          var title = g.summary || '';
          var creatorEmail = ((g.creator && g.creator.email) || (g.organizer && g.organizer.email) || '').toLowerCase();
          var startStr = (g.start && (g.start.dateTime || g.start.date)) || '';
          var startMs = startStr ? new Date(startStr).getTime() : 0;
          var visibility = g.visibility || 'default';
          var isBandEvent = looksLikeBandEvent(title, g.description);
          // 2026-04-26 hardening: 'default' visibility is what every Google
          // event gets if you don't change anything — including legitimate
          // gigs. Restrict to *explicit* private/confidential signals only.
          // Previously this caused real venue-titled gigs ("Eddie's Attic",
          // "Vista Room") to be flagged as pollution and deleted on Apply.
          var isExplicitlyPrivate = (visibility === 'private' || visibility === 'confidential');
          var isMemberCreated = bandEmailSet[creatorEmail];
          // Additional negative signals required (any one is enough — title
          // alone shouldn't flip the verdict).
          var hasNoLocation = !g.location;
          var hasShortDesc = !g.description || g.description.length < 20;
          var multiSignal = isExplicitlyPrivate && (hasNoLocation || hasShortDesc);
          // Personal pollution heuristic: created by a band member, NOT titled
          // like a band event, EXPLICITLY marked private (not default), AND
          // missing location/description — multiple signals required.
          if (isMemberCreated && !isBandEvent && multiSignal) {
            var deleteId = g.recurringEventId || g.id;
            var isRecurring = !!g.recurringEventId;
            var isMine = myEmail && creatorEmail === myEmail;
            // Pick the bucket: only events the current user owns can actually
            // be deleted via this token (Google returns 403 otherwise).
            var bucket = isMine ? report.personalPollution : report.othersPollution;
            // Dedupe recurring instances regardless of bucket.
            if (isRecurring) {
              var existing = bucket.find(function(p) {
                return p.googleEventId === deleteId;
              });
              if (existing) {
                existing.instanceCount = (existing.instanceCount || 1) + 1;
                return;
              }
            }
            bucket.push({
              googleEventId: deleteId,
              title: title || '(untitled)',
              date: startStr.substring(0, 10) || '',
              startStr: startStr,
              creator: creatorEmail,
              visibility: visibility,
              isRecurring: isRecurring,
              instanceCount: isRecurring ? 1 : 0,
              isMine: isMine
            });
          } else if (startMs && startMs < staleCutoffMs && isBandEvent) {
            // Past band event > 60 days old — informational only
            report.stale.push({
              googleEventId: g.id,
              title: title,
              date: startStr.substring(0, 10) || ''
            });
          } else {
            report.normalCount++;
          }
        });
        pageToken = data.nextPageToken || null;
      } while (pageToken);
    } catch(e) {
      report.error = report.error || ('list_exception: ' + (e && e.message));
    }

    // Newest-first ordering for the UI
    report.zombies.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    report.personalPollution.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    report.othersPollution.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return report;
  }

  // Apply audit decisions: delete zombies locally + delete pollution from
  // Google (and remove from local calendar_events if linked). Returns counts.
  async function applyAuditDecisions(decisions) {
    decisions = decisions || {};
    var result = { zombiesDeleted: 0, pollutionDeleted: 0, errors: [] };
    if (!hasCalendarScope()) { result.errors.push('no_scope'); return result; }
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) { result.errors.push('no_band_cal'); return result; }

    // 1. Zombies — local-only deletes by id
    var localEvents = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var zombieIds = (decisions.zombieIds || []);
    if (zombieIds.length) {
      var zombieSet = {};
      zombieIds.forEach(function(id) { zombieSet[id] = true; });
      var beforeZ = localEvents.length;
      localEvents = localEvents.filter(function(e) { return !(e && zombieSet[e.id]); });
      result.zombiesDeleted = beforeZ - localEvents.length;
    }

    // 2. Pollution — delete on Google AND remove any matching local entry
    var pollutionGids = (decisions.pollutionGoogleIds || []);
    var pollutionGidSet = {};
    pollutionGids.forEach(function(g) { pollutionGidSet[g] = true; });
    var onProgress = decisions.onProgress || function() {};
    var sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    var doDelete = async function(gid, attempt) {
      attempt = attempt || 1;
      var delUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(gid)
        + '?calendarId=' + encodeURIComponent(bandCalId);
      var delRes = await fetch(delUrl, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (delRes.status === 204 || delRes.status === 410 || delRes.status === 404) return { ok: true };
      // Transient — retry with exponential backoff up to 4 attempts
      if ((delRes.status === 429 || delRes.status === 500 || delRes.status === 502 || delRes.status === 503) && attempt < 4) {
        var backoff = 250 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        await sleep(backoff);
        return doDelete(gid, attempt + 1);
      }
      // Recurring-instance fallback
      if (delRes.status === 400 && /_\d{8}$/.test(gid)) {
        var parentId = gid.replace(/_\d{8}$/, '');
        var retryUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(parentId)
          + '?calendarId=' + encodeURIComponent(bandCalId);
        var retryRes = await fetch(retryUrl, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        if (retryRes.status === 204 || retryRes.status === 410 || retryRes.status === 404) return { ok: true };
        return { ok: false, status: retryRes.status, parentRetry: true };
      }
      return { ok: false, status: delRes.status };
    };

    var totalP = pollutionGids.length;
    var _successfullyDeletedGids = {};
    for (var pi = 0; pi < pollutionGids.length; pi++) {
      var gid = pollutionGids[pi];
      try {
        var r = await doDelete(gid);
        if (r.ok) {
          result.pollutionDeleted++;
          _successfullyDeletedGids[gid] = true;
        } else {
          // Failure logged but local row NOT cleaned — if Google still has
          // the event (e.g. a 500 hit), removing local would create a
          // phantom that re-imports on the next sync. Leave both intact
          // so the next audit run can retry.
          console.warn('[CalSync] Audit: delete failed for', gid, 'status:', r.status, '— leaving local row in place for retry');
          result.errors.push('delete_failed_' + r.status + '_' + gid + (r.parentRetry ? '_(parent retry)' : ''));
        }
      } catch(e) {
        result.errors.push('delete_exception_' + (e && e.message));
      }
      // Pace: ~5 req/sec stays well under Google's 10 req/sec quota and
      // avoids the burst-induced 500/503 storm Brian's audit was hitting.
      await sleep(180);
      try { onProgress({ done: pi + 1, total: totalP, deleted: result.pollutionDeleted, errors: result.errors.length }); } catch(_e) {}
    }
    // Clean local rows ONLY for gids whose Google delete actually succeeded.
    // Past code cleaned local for every attempted gid, which created phantoms
    // when a transient 5xx prevented Google delete.
    if (Object.keys(_successfullyDeletedGids).length) {
      localEvents = localEvents.filter(function(e) {
        if (!e) return false;
        var _g = e.googleEventId || (e.sync && e.sync.externalEventId);
        return !_g || !_successfullyDeletedGids[_g];
      });
    }

    // Stamp audit timestamp for the undo banner — Google Trash retains
    // deletions for ~30 days, so the UI can show a recovery hint while
    // the window is still open. Merge (don't overwrite) so syncToken etc.
    // stay intact.
    if (result.pollutionDeleted > 0) {
      try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
          await db.ref(bandPath('calendar_sync_state')).update({
            lastAuditApplied: new Date().toISOString(),
            lastAuditDeleted: result.pollutionDeleted
          });
        }
      } catch(_e) { /* non-fatal */ }
    }

    // Persist whatever changed
    if (result.zombiesDeleted > 0 || result.pollutionDeleted > 0) {
      try {
        await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(localEvents));
      } catch(e) {
        result.errors.push('save_failed_' + (e && e.message));
      }
    }
    return result;
  }

  // Diagnostic: prints everything needed to triage a member's calendar
  // configuration in their browser console. Usage:
  //   GLCalendarSync.debugMyConfig()
  // Prints email, memberKey, raw stored bandCalendarId (band-level + user-level
  // fallback), the resolved value after the group-cal guard, write access,
  // OAuth scopes, and last sync metadata. Designed to be paste-ready for
  // troubleshooting without bothering the user with a UI surface.
  async function debugMyConfig() {
    var out = { ts: new Date().toISOString() };
    try {
      out.email = (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '(unknown)';
      out.memberKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey)
        ? FeedActionState.getMyMemberKey() : null;
      out.hasCalendarScope = hasCalendarScope();
      out.hasFreeBusyScope = hasFreeBusyScope();
      out.hasAccessToken = !!accessToken;

      // Raw stored values (band-level + user-level)
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        try {
          var bsnap = await db.ref(bandPath('band_calendar/calendarId')).once('value');
          out.bandLevel_calendarId_raw = bsnap.val();
        } catch(e) { out.bandLevel_calendarId_raw = '(read error: ' + (e && e.message) + ')'; }
        try {
          var nsnap = await db.ref(bandPath('band_calendar/calendarName')).once('value');
          out.bandLevel_calendarName = nsnap.val();
        } catch(e) {}
      }
      try {
        var s = await getAvailabilitySettings();
        out.userLevel_bandCalendarId_raw = (s && s.bandCalendarId) || null;
      } catch(e) {}

      out.bandLevel_isGroupCal = out.bandLevel_calendarId_raw
        ? _isGroupCalendarId(out.bandLevel_calendarId_raw) : null;
      out.userLevel_isGroupCal = out.userLevel_bandCalendarId_raw
        ? _isGroupCalendarId(out.userLevel_bandCalendarId_raw) : null;

      // Resolved value (after guard)
      out.resolved_bandCalendarId = await _getBandCalendarId();
      out.resolved_isGroupCal = out.resolved_bandCalendarId
        ? _isGroupCalendarId(out.resolved_bandCalendarId) : false;

      // Write access (HEAD on the cal)
      try { out.canWriteBandCalendar = await canWriteBandCalendar(); }
      catch(e) { out.canWriteBandCalendar = '(check error: ' + (e && e.message) + ')'; }

      // Last sync state
      try {
        var st = await _loadSyncState();
        out.lastSyncAt = (st && st.lastSyncAt) || null;
        out.lastSyncResult = (st && st.lastSyncResult) || null;
      } catch(e) {}

      // Verdict
      var verdict;
      if (!out.hasAccessToken) verdict = 'NO TOKEN — sign in';
      else if (!out.hasCalendarScope) verdict = 'NO CALENDAR SCOPE — reconnect Google Calendar';
      else if (!out.resolved_bandCalendarId) {
        if (out.bandLevel_calendarId_raw && !out.bandLevel_isGroupCal) {
          verdict = 'BAND-LEVEL CAL ID IS NOT A GROUP CAL — fix in Rules (this is the misconfig that posts events to a personal calendar).';
        } else if (out.userLevel_bandCalendarId_raw && !out.userLevel_isGroupCal) {
          verdict = 'USER-LEVEL CAL ID IS NOT A GROUP CAL — fix in Rules (band-level not set, user fallback rejected).';
        } else {
          verdict = 'NO BAND CAL CONFIGURED — open Rules and pick the shared calendar.';
        }
      } else if (!out.canWriteBandCalendar) verdict = 'NO WRITE ACCESS to band cal — ask the calendar owner to give you "Make changes to events".';
      else verdict = 'OK — config looks correct.';
      out.verdict = verdict;

      console.log('%c[CalSync] === MY CONFIG ===', 'font-weight:bold;color:#a5b4fc');
      Object.keys(out).forEach(function(k) {
        console.log('  ' + k + ':', out[k]);
      });
      console.log('%c  → ' + verdict, 'font-weight:bold;color:' + (verdict.indexOf('OK') === 0 ? '#86efac' : '#fbbf24'));
      return out;
    } catch (err) {
      console.error('[CalSync] debugMyConfig threw:', err);
      return { error: err && err.message };
    }
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
    // Use cached `true` if we've previously confirmed write access. Don't
    // cache `false` — early-render or transient listCalendars errors would
    // otherwise lock the Health Card to "Read-only" until full reload.
    if (_bandCalAccessCache === true) return true;
    var calId = await _getBandCalendarId();
    if (!calId) return false;
    // Verify accessRole meaningfully — `writer` or `owner` actually grants
    // "Make changes to events"; `reader` / `freeBusyReader` should NOT
    // pass this check despite being in the user's calendar list.
    try {
      var cals = await listCalendars();
      if (!cals || !cals.length) return false; // transient empty result — don't cache false
      var match = cals.find(function(c) { return c.id === calId; });
      if (!match) {
        // Calendar not in list at all — definitely no write access.
        _bandCalAccessCache = false;
        return false;
      }
      var role = (match.accessRole || '').toLowerCase();
      var hasWrite = role === 'writer' || role === 'owner';
      if (hasWrite) {
        _bandCalAccessCache = true;
        return true;
      }
      // Role is reader / freeBusyReader / unknown — return false but DON'T
      // cache it; next call may reflect updated permissions.
      return false;
    } catch(e) {
      console.warn('[CalSync] canWriteBandCalendar check failed:', e && e.message);
      return false; // don't cache transient errors
    }
  }

  // ── One-time cleanup sweep ────────────────────────────────────────────────
  // Scans the band calendar, groups events by glEventId tag, keeps the
  // earliest in each group, deletes the rest. Run after the pre-push dedupe
  // ships to clean up duplicates created by prior buggy behavior.
  async function deduplicateBandCalendar() {
    if (!hasCalendarScope()) return { error: 'no scope', removed: 0, groups: 0 };
    var calId = await _getBandCalendarId();
    if (!calId) return { error: 'no band calendar configured', removed: 0, groups: 0 };

    var all = [];
    var pageToken = null;
    try {
      do {
        var now = new Date();
        var timeMin = new Date(now.getFullYear() - 1, 0, 1).toISOString();
        var timeMax = new Date(now.getFullYear() + 2, 11, 31).toISOString();
        var url = WORKER_BASE + '/calendar/events'
          + '?calendarId=' + encodeURIComponent(calId)
          + '&timeMin=' + encodeURIComponent(timeMin)
          + '&timeMax=' + encodeURIComponent(timeMax)
          + '&maxResults=250';
        if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
        var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
        if (!res.ok) return { error: 'Google API ' + res.status, removed: 0, groups: 0 };
        var data = await res.json();
        all = all.concat(data.items || []);
        pageToken = data.nextPageToken || null;
      } while (pageToken);
    } catch (e) {
      return { error: e.message || 'fetch failed', removed: 0, groups: 0 };
    }

    // Group by glEventId — only GrooveLinx-tagged events qualify.
    var groups = {};
    for (var i = 0; i < all.length; i++) {
      var ev = all[i];
      if (ev.status === 'cancelled') continue;
      var ep = ev.extendedProperties && ev.extendedProperties.private;
      var gid = ep && ep.glEventId;
      if (!gid) continue;
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(ev);
    }

    var removed = 0;
    var groupsProcessed = 0;
    var errors = [];
    var groupKeys = Object.keys(groups);
    for (var g = 0; g < groupKeys.length; g++) {
      var list = groups[groupKeys[g]];
      if (list.length < 2) continue;
      groupsProcessed++;
      list.sort(function (a, b) {
        var ta = Date.parse(a.created || 0), tb = Date.parse(b.created || 0);
        return ta - tb;
      });
      // Keep list[0], delete list[1..]
      for (var d = 1; d < list.length; d++) {
        try {
          var r = await remove(list[d].id);
          if (r && r.success !== false) removed++;
          else errors.push(list[d].id);
        } catch (e) { errors.push(list[d].id); }
      }
    }

    console.log('[CalSync] Dedupe sweep: removed', removed, 'from', groupsProcessed, 'groups');
    return {
      scanned: all.length,
      groups: groupsProcessed,
      removed: removed,
      errors: errors.length
    };
  }

  // ── Re-push times to Google ───────────────────────────────────────────────
  // Walks every synced calendar_event and PATCHes its Google counterpart with
  // the correct start/end times. Two sources of truth:
  //   (1) If the event is linked to a Gig (by gigId or venue+date), the Gig's
  //       startTime/endTime win — reconciles calendar_event from Gig first.
  //   (2) If no matching Gig, uses the calendar_event's own time/endTime.
  //       Covers events created directly via the Calendar "Add Event" form.
  // One-shot fix for existing Google events still showing the 7-9 PM default
  // because endTime was never plumbed through the old pipeline.
  async function refreshGigTimesOnGoogle() {
    if (!hasCalendarScope()) return { error: 'no scope', updated: 0, scanned: 0 };
    var calId = await _getBandCalendarId();
    if (!calId) return { error: 'no band calendar configured', updated: 0, scanned: 0 };

    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      return { error: 'firebase helpers unavailable', updated: 0, scanned: 0 };
    }

    var gigs = [], events = [];
    try {
      var rawGigs = await loadBandDataFromDrive('_band', 'gigs') || {};
      gigs = Array.isArray(rawGigs) ? rawGigs : Object.keys(rawGigs).map(function (k) { return rawGigs[k]; });
      events = (typeof toArray === 'function')
        ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
        : [];
    } catch (e) {
      return { error: e.message || 'load failed', updated: 0, scanned: 0 };
    }

    // Index Gigs by gigId + venue|date for fast lookup.
    var gigById = {};
    var gigByVenueDate = {};
    gigs.forEach(function (g) {
      if (!g || !g.date) return;
      if (g.gigId) gigById[g.gigId] = g;
      var key = (g.venue || '') + '|' + g.date;
      if (!gigByVenueDate[key]) gigByVenueDate[key] = g;
    });

    var updated = 0;
    var scanned = 0;
    var firebaseChanged = false;
    var errors = [];

    // Iterate calendar_events — the canonical list of what's on Google.
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || !ev.date) continue;
      var externalId = ev.googleEventId || (ev.sync && ev.sync.externalEventId);
      if (!externalId) continue; // nothing to update on Google
      if (ev.isAllDay || ev.endDate) continue; // skip multi-day / all-day events

      scanned++;

      // Prefer Gig record as source of truth when one exists.
      var gig = (ev.gigId && gigById[ev.gigId])
        || gigByVenueDate[(ev.venue || ev.title || '') + '|' + ev.date]
        || null;

      var desiredStart = gig && gig.startTime ? gig.startTime : (ev.time || '');
      var desiredEnd   = gig && gig.endTime   ? gig.endTime   : (ev.endTime || '');

      if (!desiredStart) continue; // can't push a time we don't have

      // Reconcile local calendar_event with whichever source we used.
      if (ev.time !== desiredStart) { ev.time = desiredStart; firebaseChanged = true; }
      if (desiredEnd && ev.endTime !== desiredEnd) { ev.endTime = desiredEnd; firebaseChanged = true; }
      if (firebaseChanged) ev.updated = new Date().toISOString();

      var glEvent = {
        id: ev.id || '',
        eventId: ev.id || '',
        summary: ev.title,
        date: ev.date,
        startTime: desiredStart,
        endTime: desiredEnd,
        location: ev.location || ev.venue || '',
        description: ev.notes || '',
        type: ev.type
      };
      try {
        var res = await update(externalId, glEvent);
        if (res && res.success) {
          updated++;
          ev.lastSyncedAt = new Date().toISOString();
          firebaseChanged = true;
        } else {
          errors.push((ev.venue || ev.title || 'event') + ' ' + ev.date);
        }
      } catch (e) {
        errors.push((ev.venue || ev.title || 'event') + ' ' + ev.date + ': ' + (e.message || 'error'));
      }
    }

    if (firebaseChanged) {
      try { await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events)); }
      catch (e) { console.warn('[CalSync] Firebase save failed:', e && e.message); }
    }

    return { scanned: scanned, updated: updated, errors: errors.length };
  }

  // ── Purge events not on the configured band calendar ─────────────────────
  // Mode A contract: ONLY the shared band calendar contributes. Legacy free/
  // busy imports (from when the band was in Mode B) live in calendar_events
  // as type='other' with title='Busy' and calendarId either missing or
  // pointing at a different calendar. This sweep removes them so they stop
  // polluting Mode A scheduling.
  // Preserves:
  //   - GrooveLinx-authored events (no _importedFromGoogle flag)
  //   - Events whose calendarId matches the currently-configured band calendar
  async function purgeNonBandEvents() {
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      return { error: 'firebase helpers unavailable', removed: 0, scanned: 0 };
    }
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) return { error: 'no band calendar configured', removed: 0, scanned: 0 };
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var kept = [];
    var removed = 0;
    events.forEach(function (ev) {
      if (!ev || !ev._importedFromGoogle) { kept.push(ev); return; }
      var evCal = ev.calendarId || (ev.sync && ev.sync.calendarId) || '';
      if (evCal === bandCalId) { kept.push(ev); return; }
      // Imported but not from the band calendar — remove.
      removed++;
      console.log('[CalSync] purge removing:', ev.date, '|', JSON.stringify(ev.title), '| calendarId:', evCal || '(none)');
    });
    if (removed > 0) {
      try { await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(kept)); }
      catch (e) { console.warn('[CalSync] purge save failed:', e && e.message); }
    }
    return { scanned: events.length, removed: removed, kept: kept.length };
  }

  // ── Backfill: re-classify already-imported events ────────────────────────
  // Walks local calendar_events and re-runs the unavailability title check on
  // every event that isn't a rehearsal/gig. Needed because events imported
  // before detection shipped (or before it was added to the syncBandCalendar
  // path) are sitting at type='other' with no assignedMembers — they fail to
  // block availability silently.
  async function reclassifyUnavailability() {
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      return { error: 'firebase helpers unavailable', updated: 0, scanned: 0 };
    }
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    var updated = 0;
    var scanned = 0;
    // Diagnostic: confirm member index is populated. If bandMembers isn't
    // globally loaded yet, we'd silently match zero names.
    var _memDiag = _buildMemberNameIndex();
    console.log('[CalSync] reclassify: memberNames =', Object.keys(_memDiag.memberNames));

    // Track candidates that LOOK like unavailability but didn't match — these
    // are the diagnostic-worthy ones (most logs every-event-spam was noise).
    var _ambiguousCandidates = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || !ev.title) continue;
      if (ev.type === 'rehearsal' || ev.type === 'gig') continue;
      scanned++;
      var r = _detectUnavailability(ev.title);
      // Only log the AMBIGUOUS cases — events whose title hints at busy/out
      // but didn't classify. These are the ones worth investigating. The
      // matched-and-upgraded case logs separately below.
      if (!r.isUnavail && /busy|off|out|away|unavail|conflict|blocked/i.test(ev.title)) {
        _ambiguousCandidates.push({ date: ev.date, title: ev.title, type: ev.type });
      }
      if (!r.isUnavail) continue;
      var nextType = r.scope === 'unassigned' ? 'unavailable_unassigned' : 'unavailable';
      var changed = false;
      if (ev.type !== nextType) { ev.type = nextType; changed = true; }
      if (r.scope !== 'unassigned') {
        var priorMembers = ev.assignedMembers || [];
        var sameMembers = priorMembers.length === r.members.length
          && priorMembers.every(function (m) { return r.members.indexOf(m) !== -1; });
        if (!sameMembers) { ev.assignedMembers = r.members.slice(); changed = true; }
        if (ev.blockScope !== r.scope) { ev.blockScope = r.scope; changed = true; }
      }
      if (changed) {
        ev.updated_at = new Date().toISOString();
        updated++;
        console.log('[CalSync] reclassify UPGRADED:', ev.date, '|', ev.title, '→', ev.type, ev.assignedMembers || []);
      }
    }
    if (updated > 0) {
      try {
        await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
        console.log('[CalSync] reclassify saved', updated, 'changes to Firebase');
      }
      catch (e) { console.warn('[CalSync] reclassify save failed:', e && e.message); }
    } else {
      console.log('[CalSync] reclassify: scanned', scanned, 'events, no upgrades needed');
    }
    if (_ambiguousCandidates.length) {
      console.log('[CalSync] reclassify: ' + _ambiguousCandidates.length + ' ambiguous title(s) (busy-ish but not matched):',
        _ambiguousCandidates.slice(0, 5).map(function(c) { return c.title; }));
    }
    return { scanned: scanned, updated: updated };
  }

  // Debug helper — comprehensive search across event types for a specific
  // title across all accessible calendars. Hunts down events the default
  // events.list query doesn't return: Out of Office, Focus Time, Working
  // Location, soft-deleted, and events on calendars we forgot we had.
  // Usage:
  //   await GLCalendarSync.debugFindEvent('brian busy', '2026-06-01', '2026-06-30')
  async function debugFindEvent(titleFragment, startDate, endDate) {
    if (!hasCalendarScope() || !accessToken) { console.log('[debug] no token'); return; }
    var frag = (titleFragment || '').toLowerCase();
    var timeMin = (startDate || '2026-01-01') + 'T00:00:00Z';
    var timeMax = (endDate || '2026-12-31') + 'T23:59:59Z';
    var cals = [];
    try {
      var listRes = await fetch(WORKER_BASE + '/calendar/list', {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      var listData = await listRes.json();
      cals = (listData.items || []).map(function (c) { return { id: c.id, summary: c.summary || c.id }; });
    } catch (e) { console.log('[debug] list failed:', e.message); return; }

    console.log('[debug] searching', cals.length, 'calendars for:', JSON.stringify(frag));

    // eventType variants Google exposes — default scope misses OOO/focusTime
    // /workingLocation events even when they're on the queried calendar.
    var types = ['default', 'outOfOffice', 'focusTime', 'workingLocation'];
    var total = 0;

    for (var ci = 0; ci < cals.length; ci++) {
      var c = cals[ci];
      var calTotal = 0;
      for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        try {
          // Worker doesn't pass eventTypes through — fetch Google directly.
          var url = 'https://www.googleapis.com/calendar/v3/calendars/'
            + encodeURIComponent(c.id)
            + '/events?timeMin=' + encodeURIComponent(timeMin)
            + '&timeMax=' + encodeURIComponent(timeMax)
            + '&singleEvents=true&maxResults=250&showDeleted=true'
            + '&eventTypes=' + encodeURIComponent(t);
          var r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
          if (!r.ok) continue;
          var d = await r.json();
          var items = d.items || [];
          items.forEach(function (ev) {
            var title = (ev.summary || '').toLowerCase();
            if (!frag || title.indexOf(frag) !== -1) {
              console.log('  [HIT]',
                'cal:', c.summary, '|',
                'type:', t, '|',
                (ev.start && (ev.start.dateTime || ev.start.date)) || '?', '|',
                JSON.stringify(ev.summary || '(no title)'), '|',
                'status:', ev.status, '|',
                'visibility:', ev.visibility || 'default', '|',
                'eventType:', ev.eventType || 'default', '|',
                'creator:', ev.creator && ev.creator.email);
              calTotal++; total++;
            }
          });
        } catch (e) { /* skip */ }
      }
      if (calTotal > 0) console.log('  (' + calTotal + ' match(es) on "' + c.summary + '")');
    }
    if (total === 0) {
      console.log('[debug] ZERO matches found across', cals.length, 'calendars × 4 event types.');
      console.log('[debug] If Brian says the event exists, it may be:');
      console.log('         - A Google Task (separate API, not Calendar)');
      console.log('         - On a calendar not shared with this account');
      console.log('         - On a Workspace calendar with domain-restricted visibility');
    }
    return total;
  }

  // Debug helper — bypass every guard and hit the worker's /calendar/list
  // directly. Used to diagnose when listCalendars() returns [] because
  // _calendarScopeFailed got stuck to true earlier in the session.
  // Usage: await GLCalendarSync.debugListCalendarsRaw()
  async function debugListCalendarsRaw() {
    if (typeof accessToken === 'undefined' || !accessToken) {
      console.log('[debug] no accessToken — run a sync first');
      return;
    }
    try {
      var res = await fetch(WORKER_BASE + '/calendar/list', {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      console.log('[debug] HTTP status:', res.status);
      var txt = await res.text();
      if (!res.ok) { console.log('[debug] body:', txt); return; }
      var data = JSON.parse(txt);
      console.log('[debug] returned', (data.items || []).length, 'calendars');
      (data.items || []).forEach(function (c) {
        console.log('  ', JSON.stringify(c.summary), '| id:', c.id, '| access:', c.accessRole, '| primary:', !!c.primary);
      });
      return data.items || [];
    } catch (e) {
      console.log('[debug] error:', e && e.message);
    }
  }

  // Debug helper — fetch raw Google API response for any calendar over
  // a date range. Shows what's actually on Google (vs what we have locally).
  // Usage:
  //   await GLCalendarSync.debugBandCalendarRaw('2026-06-01', '2026-06-30')
  //   await GLCalendarSync.debugBandCalendarRaw('2026-06-01', '2026-06-30', 'primary')
  //   await GLCalendarSync.debugBandCalendarRaw('2026-06-01', '2026-06-30', 'drewmerrill1029@gmail.com')
  async function debugBandCalendarRaw(startDate, endDate, calIdOverride) {
    if (!hasCalendarScope()) { console.log('[debug] no calendar scope'); return; }
    var calId = calIdOverride || (await _getBandCalendarId());
    if (!calId) { console.log('[debug] no calendar id'); return; }
    console.log('[debug] querying calendar:', calId);
    var timeMin = startDate + 'T00:00:00Z';
    var timeMax = endDate + 'T23:59:59Z';
    var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(calId)
      + '&timeMin=' + encodeURIComponent(timeMin)
      + '&timeMax=' + encodeURIComponent(timeMax)
      + '&maxResults=250';
    try {
      var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (!res.ok) { console.log('[debug] fetch failed:', res.status, await res.text()); return; }
      var data = await res.json();
      console.log('[debug] Google returned', (data.items || []).length, 'events on', calId);
      (data.items || []).forEach(function (ev) {
        console.log('  ', (ev.start && (ev.start.date || ev.start.dateTime)) || '?',
          '|', JSON.stringify(ev.summary || '(no title)'),
          '| id:', ev.id,
          '| creator:', ev.creator && ev.creator.email,
          '| organizer:', ev.organizer && ev.organizer.email);
      });
      return data.items || [];
    } catch (e) {
      console.log('[debug] fetch error:', e && e.message);
    }
  }

  // Debug helper — paste into console to inspect what's actually stored.
  // Usage: await GLCalendarSync.debugUnavailableScan()
  async function debugUnavailableScan() {
    if (typeof loadBandDataFromDrive !== 'function') {
      console.log('[debug] loadBandDataFromDrive not available');
      return;
    }
    var events = (typeof toArray === 'function')
      ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
      : [];
    console.log('[debug] memberNames:', Object.keys(_buildMemberNameIndex().memberNames));
    console.log('[debug] total events:', events.length);
    var ofInterest = events.filter(function (ev) {
      return ev && ev.title && /busy|off|out|away|unavail|conflict|blocked/i.test(ev.title);
    });
    console.log('[debug] potentially-unavailable events (' + ofInterest.length + '):');
    ofInterest.forEach(function (ev) {
      var r = _detectUnavailability(ev.title);
      console.log('  ', ev.date, '|', JSON.stringify(ev.title),
        '| type:', ev.type,
        '| assignedMembers:', ev.assignedMembers,
        '| blockScope:', ev.blockScope,
        '| detectResult:', r);
    });
    return ofInterest;
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
    getSyncState: getSyncState,
    runHiddenEventCheck: _runHiddenEventCheck,
    getSyncActivity: getSyncActivity,
    debugMyConfig: debugMyConfig,
    detectAccountDefaultVisibility: detectAccountDefaultVisibility,
    runCalendarHealthCheck: runCalendarHealthCheck,
    auditCalendarPollution: auditCalendarPollution,
    applyAuditDecisions: applyAuditDecisions,
    deduplicateBandCalendar: deduplicateBandCalendar,
    refreshGigTimesOnGoogle: refreshGigTimesOnGoogle,
    reclassifyUnavailability: reclassifyUnavailability,
    purgeNonBandEvents: purgeNonBandEvents,
    debugUnavailableScan: debugUnavailableScan,
    debugBandCalendarRaw: debugBandCalendarRaw,
    debugListCalendarsRaw: debugListCalendarsRaw,
    debugFindEvent: debugFindEvent,
    pullBandCalendarEvents: pullBandCalendarEvents,
    _getBandEmails: _getBandEmails,
    _buildEventBody: _buildEventBody
  };

})();

console.log('\u2705 gl-calendar-sync.js loaded');
