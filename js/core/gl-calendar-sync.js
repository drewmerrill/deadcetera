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

  // ── Scope taxonomy (Audit M17, 2026-05-05) ───────────────────────────────
  //
  // Three Google Calendar scopes exist; a session can hold any subset:
  //   • https://www.googleapis.com/auth/calendar             (full)
  //   • https://www.googleapis.com/auth/calendar.events      (events read+write)
  //   • https://www.googleapis.com/auth/calendar.readonly    (read-only)
  //   • https://www.googleapis.com/auth/calendar.freebusy    (busy time only)
  //
  // Per-operation policy (use the NARROWEST gate that's correct):
  //
  //   READ events.list  (events read)         → hasCalendarScope()
  //                                             (full / events / readonly all work;
  //                                              events scope grants list+get)
  //   WRITE events.insert/patch/delete        → hasCalendarEventsScope()
  //                                             (full or events; readonly is NOT enough)
  //   READ freeBusy.query                     → hasFreeBusyScope()
  //                                             (full / readonly / freebusy work;
  //                                              events scope is NOT enough)
  //   READ calendarList.list                  → hasCalendarScope()
  //   WRITE calendars/* mutations             → full /auth/calendar only
  //
  // Why a single `hasCalendarScope()` is not enough: it lumps all three
  // grants into one boolean, which over-restricts events-only sessions
  // (D13 audit finding) and under-protects freebusy-only sessions. New code
  // must pick the gate from the table above; lint with a code search for
  // any `hasCalendarScope` call that's followed by a POST/PATCH/DELETE.
  // ──────────────────────────────────────────────────────────────────────────
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

  // Granular gate: are we authorized to MUTATE events on Google? Either
  // calendar.events scope OR full /auth/calendar suffices. The audit (D13)
  // showed that hasCalendarScope() over-restricted partial-scope OAuth
  // sessions (events-only) by lumping all scopes into one boolean. This
  // helper reads window._grantedScopes directly so callers can mutate when
  // events scope is held even if the legacy boolean didn't fire.
  function hasCalendarEventsScope() {
    if (typeof accessToken === 'undefined' || !accessToken) return false;
    var raw = (typeof window !== 'undefined') ? (window._grantedScopes || '') : '';
    if (typeof raw !== 'string') raw = '';
    if (!raw) {
      // No raw bag available (likely a cached session before OAuth callback
      // fired this load). Fall back to the legacy boolean — if it's true,
      // some calendar scope was granted; events scope is the most common
      // grant so let the helper say yes.
      return hasCalendarScope();
    }
    if (raw.indexOf('calendar.events') !== -1) return true;
    // /auth/calendar (full) suffices for everything events-scope can do.
    if (raw.split(' ').some(function(s) { return s === 'https://www.googleapis.com/auth/calendar' || s === 'auth/calendar'; })) return true;
    return false;
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
    // Source 3: config fallback — freeBusy works under full `calendar` OR `calendar.readonly`.
    // calendar.events alone is NOT enough (Google's docs are explicit on this).
    if (typeof GOOGLE_DRIVE_CONFIG !== 'undefined' && GOOGLE_DRIVE_CONFIG.scope) {
      var _scope = GOOGLE_DRIVE_CONFIG.scope;
      var _hasReadonly = _scope.indexOf('calendar.readonly') !== -1;
      // "full calendar" = /auth/calendar present AND not just calendar.events / calendar.readonly
      var _hasFullCalScope = _scope.indexOf('/auth/calendar ') !== -1
        || _scope.match(/\/auth\/calendar$/);
      if (_hasReadonly || _hasFullCalScope) {
        console.log('[CalSync] hasFreeBusyScope: true (config fallback — readonly/full scope requested)');
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
      // D5 fix (2026-05-04): never synthesize "<bandName> Event" for unknown
      // types. The fallback "Event" string was bleeding into Google when
      // imported personal-cal rows (type:'unavailable') got pushed via the
      // Phase 1 dirty-event loop, renaming Drew/Brian "Busy" events to
      // "deadcetera Event" on their personal calendars. Now: preserve the
      // user's title verbatim; only synthesize a "<bandName> <Type>" label
      // when both the title is missing AND the type is one we recognize.
      // Unknown type + no title \u2192 return null summary so callers can refuse
      // to push (defense in depth at update()/create()).
      if (explicitTitle) {
        summary = explicitTitle;
      } else if (typeLabel[glEvent.type]) {
        summary = (bandName ? bandName + ' ' : '') + typeLabel[glEvent.type];
      } else {
        summary = null;
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

  // Band timezone — single source for date/time extraction from Google's
  // RFC3339 datetime strings. Currently hardcoded; matches the timeZone
  // we set in _buildEventBody. Future: read from band record.
  var BAND_TZ = 'America/New_York';

  // Extract local HH:MM from a Google RFC3339 datetime in BAND_TZ. Google's
  // dateTime field comes back EITHER with explicit offset
  // ("2026-05-30T20:00:00-04:00") or in UTC ("2026-05-31T00:00:00Z"),
  // depending on the calendar's default timezone setting. Naive
  // substring(11,16) silently breaks on the UTC case (gives "00:00" for a
  // 20:00 ET event). Parse → format in BAND_TZ to get the right local
  // time regardless of input form. Returns '' for date-only or invalid input.
  function _extractLocalHM(isoStr) {
    if (!isoStr || typeof isoStr !== 'string' || isoStr.length <= 10) return '';
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr.substring(11, 16);
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: BAND_TZ, hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(d);
      var hh = '', mm = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'hour') hh = parts[i].value;
        else if (parts[i].type === 'minute') mm = parts[i].value;
      }
      if (hh === '24') hh = '00'; // some Intl impls emit 24 for midnight
      return (hh && mm) ? (hh + ':' + mm) : isoStr.substring(11, 16);
    } catch (e) { return isoStr.substring(11, 16); }
  }

  // Extract local YYYY-MM-DD from a Google RFC3339 datetime in BAND_TZ.
  // Same UTC-vs-offset issue as _extractLocalHM: a 20:00 ET event returned
  // as "2026-05-31T00:00:00Z" would give "2026-05-31" via substring, but
  // it's actually on 5/30 in the band's timezone. Date-only strings (the
  // all-day case) are passed through as-is.
  function _extractLocalDate(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return '';
    if (isoStr.length === 10) return isoStr;
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr.substring(0, 10);
      // en-CA produces YYYY-MM-DD; safer than building from parts.
      var s = new Intl.DateTimeFormat('en-CA', {
        timeZone: BAND_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : isoStr.substring(0, 10);
    } catch (e) { return isoStr.substring(0, 10); }
  }

  // Self-heal compounded titles like "Venue — Venue — Venue" or
  // "Venue — Venue — Title". Past _buildEventBody bugs accumulated repeats
  // each sync. Generalized so it doesn't need the venue field as input —
  // detects any leading run of identical segments separated by em-dash.
  // Returns { title, wasCorrupt }.
  //   "A — A — A"     -> "A"
  //   "A — A — B"     -> "A — B"
  //   "A — A — A — B" -> "A — B"
  //   "A — B"         -> "A — B" (unchanged)
  function _cleanCompoundedTitle(title) {
    if (!title || typeof title !== 'string') return { title: title || '', wasCorrupt: false };
    var EM = '—';
    var segs = title.split(new RegExp('\\s*' + EM + '\\s*'));
    if (segs.length < 2) return { title: title, wasCorrupt: false };
    var trimmed = segs.map(function(s) { return s.trim(); });
    var norm = trimmed.map(function(s) { return s.toLowerCase(); });
    var run = 1;
    while (run < norm.length && norm[run] === norm[0]) run++;
    if (run < 2) return { title: title, wasCorrupt: false };
    var head = trimmed[0];
    if (run === segs.length) return { title: head, wasCorrupt: true };
    var tail = trimmed.slice(run).join(' ' + EM + ' ');
    return { title: head + ' ' + EM + ' ' + tail, wasCorrupt: true };
  }

  // Shared classifier — both the live import path (_importGoogleEvent) and
  // the Path B.2 multi-day expansion use this so they can't drift apart.
  // Order: rehearsal/practice wins over jam (a "studio jam" is rehearsal,
  // not a gig). Meeting wins over generic gig keywords.
  function _classifyEventType(summary) {
    var lc = String(summary || '').toLowerCase().replace(/\u2019/g, "'");
    // Negation guard — "Pierce can't rehearse", "No rehearsal", "rehearsal
    // cancelled", "won't make practice" — these are unavailability or
    // cancellation signals, NOT a scheduled rehearsal/gig. Returning 'other'
    // lets _detectUnavailability and the band-cal-source rule pick them up
    // (member name + "can't" → that member's block; "no rehearsal" →
    // whole-band phrase already handled).
    var _negated = /\b(can'?t|cannot|won'?t|wont|not|no)\s+\S+(\s+\S+){0,3}\s*(rehears|practice|gig|show|concert)/i.test(lc)
      || /^(no|cancel+ed|cancelling)\s+(rehears|practice|gig|show|concert)/i.test(lc)
      || /(rehears|practice|gig|show|concert)\w*\s+(is\s+)?(cancel+ed|canceled|cancelling|cancellation|off)\b/i.test(lc)
      || /\brehearsal\s+cancel/i.test(lc);
    if (_negated) return 'other';
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
      // Query window: 1 day before through 1 day after the target. Wider
      // than just "the target day" because Google all-day events use UTC
      // midnight in their date-only format — for an ET-timezone user, our
      // local-midnight timeMin would skip the start of an all-day event
      // by 4 hours, and we'd miss the dedupe match. Expand to ±1 day so
      // it doesn't matter where the timezone boundary falls.
      var _startDate = new Date(dateStr + 'T00:00:00Z');
      _startDate.setUTCDate(_startDate.getUTCDate() - 1);
      var _start = _startDate.toISOString();
      var _endDate = new Date(dateStr + 'T00:00:00Z');
      _endDate.setUTCDate(_endDate.getUTCDate() + 2);
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

  // Audit M4 (2026-05-04): bounded retry wrapper for transient Google API
  // failures (429 rate-limit, 500/502/503/504 server hiccups). Honors the
  // `Retry-After` response header when present; otherwise exponential backoff.
  // Wrap mutation fetches (create/update/remove) so a brief upstream blip
  // doesn't leave a row stuck dirty for the next sync interval. Network
  // exceptions (no response object) are also retried within the same budget.
  async function _withRetry(fetchFn, opts) {
    var maxAttempts = (opts && opts.maxAttempts) || 3;
    var baseDelayMs = (opts && opts.baseDelayMs) || 400;
    var maxDelayMs  = (opts && opts.maxDelayMs)  || 8000;
    var label = (opts && opts.label) || 'fetch';
    var lastErr = null;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        var res = await fetchFn();
        var transient = (res && (res.status === 429 || (res.status >= 500 && res.status <= 599)));
        if (!transient) return res;
        if (attempt === maxAttempts) return res;
        var ra = parseInt(res.headers && res.headers.get && res.headers.get('Retry-After'), 10);
        var delay = (!isNaN(ra) && ra > 0) ? ra * 1000 : baseDelayMs * Math.pow(2, attempt - 1);
        delay = Math.min(delay, maxDelayMs);
        console.warn('[CalSync] _withRetry(' + label + '): attempt', attempt, '/', maxAttempts,
          '— status', res.status, '— sleeping', delay, 'ms');
        await new Promise(function(r){ setTimeout(r, delay); });
      } catch (e) {
        lastErr = e;
        if (attempt === maxAttempts) throw e;
        var nDelay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        console.warn('[CalSync] _withRetry(' + label + '): attempt', attempt, '/', maxAttempts,
          '— network error', (e && e.message) || e, '— sleeping', nDelay, 'ms');
        await new Promise(function(r){ setTimeout(r, nDelay); });
      }
    }
    if (lastErr) throw lastErr;
    throw new Error('retry_exhausted');
  }

  async function create(glEvent, opts) {
    // D13 audit fix: use granular gate. calendar.events scope is sufficient
    // for POST events.insert; the conflated hasCalendarScope() over-restricts
    // partial-scope sessions.
    if (!hasCalendarEventsScope()) {
      // Preserve fallback URL behavior — same as before, but tag with a
      // classified error so callers can distinguish "no scope" from other
      // failures instead of seeing the bare {success:false,fallback:true}.
      var _fb = _fallbackUrl(glEvent, opts);
      _fb.error = _fb.error || 'no_scope';
      return _fb;
    }

    var glEventId = glEvent.id || glEvent.eventId || '';
    var _opts = Object.assign({}, opts, { glEventId: glEventId });
    var body = _buildEventBody(glEvent, _opts);
    // D5 guard: refuse to create a Google event with no real title. This
    // protects against the imported-personal-cal-row corruption pattern
    // where a typeless event would otherwise be created with whatever
    // _buildEventBody fell back to.
    if (!body || !body.summary) {
      console.warn('[CalSync] create() refused — no usable title for', glEvent && glEvent.type, 'event id=', glEventId);
      return { success: false, error: 'no_title' };
    }
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
      var res = await _withRetry(function() {
        return fetch(_postUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify(body)
        });
      }, { label: 'create' });

      if (!res.ok) {
        var errText = await res.text();
        console.warn('[CalSync] Create failed:', res.status, errText);
        // Audit M5 (2026-05-04): propagate status so Phase 1 can flip
        // result.needsReauth on 401/403 and the toast can prompt re-auth.
        return { success: false, status: res.status, error: 'Google Calendar returned ' + res.status, fallback: true };
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
    // D13 audit fix: granular gate + classified error code instead of bare
    // {success:false}. cleanupOrphanGigEvents was bubbling 'unknown' here.
    if (!hasCalendarEventsScope()) {
      return { success: false, error: 'no_scope', fallback: true };
    }
    if (!externalEventId) {
      return { success: false, error: 'no_event_id', fallback: true };
    }

    var _opts = Object.assign({}, opts, { glEventId: glEvent.id || glEvent.eventId || '' });
    var body = _buildEventBody(glEvent, _opts);
    // D5 guard: never PATCH Google with a missing/synthesized fallback
    // title — that's the path that was renaming "Drew Busy" to "deadcetera
    // Event" on personal calendars. If _buildEventBody couldn't resolve a
    // real title, abort and leave the event dirty for the next sync.
    if (!body || !body.summary) {
      console.warn('[CalSync] update() refused — no usable title for', glEvent && glEvent.type, 'gid=', externalEventId);
      return { success: false, error: 'no_title' };
    }
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
    // Recurring-event awareness: if the eventId looks like an instance ID
    // (parent_YYYYMMDD), the PATCH creates a single-instance override on
    // Google. If it's a parent series ID, the PATCH updates the entire
    // series. The user usually intends "this one only" — but the current
    // UI doesn't expose the choice, so log so any "why did all my Mondays
    // change?" questions are diagnosable.
    if (/_\d{8}$/.test(externalEventId)) {
      console.log('[CalSync] update(): event ID looks like a single recurring INSTANCE — PATCH will create an instance override. The series remains unchanged.');
    } else if (glEvent.recurrence || glEvent.recurringEventId) {
      console.warn('[CalSync] update(): event has recurrence — PATCH may update the ENTIRE SERIES. If you only meant to edit one date, this affects every occurrence.');
    }
    try {
      var res = await _withRetry(function() {
        return fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify(body)
        });
      }, { label: 'update' });

      if (!res.ok) {
        console.warn('[CalSync] Update failed:', res.status);
        // Audit M5: include httpStatus so callers can detect 401/403 and
        // flip needsReauth. Existing `status: 'error'` is the row-level
        // sync state and must be preserved for legacy consumers.
        return { success: false, error: 'Update failed: ' + res.status, status: 'error', httpStatus: res.status };
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
    // D13 audit fix: granular gate + classified error code.
    if (!hasCalendarEventsScope()) {
      return { success: false, error: 'no_scope' };
    }
    if (!externalEventId) {
      return { success: false, error: 'no_event_id' };
    }

    var calId = await _getBandCalendarId();
    if (!calId) return { success: false, error: 'No band calendar configured.' };

    try {
      var _delUrl = WORKER_BASE + '/calendar/events/' + encodeURIComponent(externalEventId) + '?calendarId=' + encodeURIComponent(calId);
      var res = await _withRetry(function() {
        return fetch(_delUrl, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
      }, { label: 'remove' });

      // 204 = success, 410 = already deleted
      if (res.status === 204 || res.status === 410) {
        return { success: true, status: 'detached' };
      }

      // Audit M5: surface httpStatus for 401/403 → needsReauth bubble.
      return { success: false, error: 'Delete failed: ' + res.status, httpStatus: res.status };
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
      // 2026-05-04: 404/410 = the Google event was deleted out from under us.
      // Don't keep poking it on every sync — return a sentinel so the caller
      // can mark the local row's sync.status as 'orphaned'. We do NOT delete
      // the local row (D4 lesson: auto-deletes were the original loss vector).
      if (res.status === 404 || res.status === 410) return 'orphan';
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
  var _STRONG_UNAVAIL_KW = ['out', 'unavailable', 'pto', 'vacation', 'away', 'travel', "can't", 'cannot', "won't"];
  var _WEAK_UNAVAIL_KW = ['busy', 'conflict', 'off', 'blocked'];
  var _WHOLE_BAND_PHRASES = ['band off', 'full band off', 'everyone out', 'no rehearsal', 'rehearsal cancelled', 'rehearsal canceled', 'band unavailable', 'all out', 'band away'];

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
    // Normalize curly apostrophes (Google's mobile autocorrect produces \u2019)
    // to straight ' so "can't" matches whether typed on iOS or web.
    var lc = title.toLowerCase().trim().replace(/\u2019/g, "'");
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
  // Audit fix (H5 2026-05-04): accept an explicit calendarId so callers can
  // unambiguously target the band cal vs. their personal/primary cal. Prior
  // signature dropped the calendarId param and the worker silently defaulted
  // to 'primary' — meaning this function returned each user's PERSONAL
  // calendar events labeled as generic Google events. Mode-A overlay caller
  // intentionally wants 'primary' (Mode B feature), so 'primary' remains the
  // default — but every caller must now make the choice consciously.
  async function listGoogleEvents(timeMin, timeMax, opts) {
    if (!hasCalendarScope()) return [];
    if (_calendarScopeFailed) return [];
    opts = opts || {};
    var calId = opts.calendarId || 'primary';
    if (calId === 'primary') {
      console.log('[CalSync] listGoogleEvents() reading from PRIMARY calendar (pass opts.calendarId for band cal).');
    }
    try {
      var url = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(calId)
        + '&timeMin=' + encodeURIComponent(timeMin)
        + '&timeMax=' + encodeURIComponent(timeMax);
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

  // ── Maintenance mode (audit T1.1, 2026-05-04) ──────────────────────────────
  // Stage-1 of the calendar audit: migrations and repair tools must be able to
  // freeze sync mid-operation so a routine sync doesn't run between migration
  // steps and re-push/pull a half-migrated state. D11 was caused by this gap.
  //
  // Schema: bands/{slug}/calendar_sync_state.maintenanceUntil (ISO ts) +
  //         bands/{slug}/calendar_sync_state.maintenanceReason (string).
  // When maintenanceUntil > now, syncBandCalendar early-returns
  // {skipped:true, reason:'maintenance', until:<ts>} and logs to sync_activity.
  async function _readMaintenanceState() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { active: false };
    try {
      var snap = await db.ref(bandPath('calendar_sync_state')).once('value');
      var st = snap.val() || {};
      var until = st.maintenanceUntil || null;
      if (!until) return { active: false };
      var untilMs = Date.parse(until);
      if (isNaN(untilMs) || untilMs <= Date.now()) return { active: false, until: until, reason: st.maintenanceReason || null, expired: true };
      return { active: true, until: until, reason: st.maintenanceReason || null };
    } catch(e) {
      // On read error, fail OPEN — never block sync because Firebase is glitchy.
      console.warn('[CalSync] maintenance read error (failing open):', e && e.message);
      return { active: false, error: e && e.message };
    }
  }

  async function setMaintenance(minutes, reason) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false, error: 'firebase_unavailable' };
    var mins = (typeof minutes === 'number' && minutes > 0) ? minutes : 30;
    var untilMs = Date.now() + mins * 60 * 1000;
    var untilIso = new Date(untilMs).toISOString();
    try {
      await db.ref(bandPath('calendar_sync_state')).update({
        maintenanceUntil: untilIso,
        maintenanceReason: reason || 'migration',
        maintenanceSetAt: new Date().toISOString()
      });
      console.log('[CalSync] Maintenance ON until', untilIso, '— reason:', reason || 'migration');
      return { ok: true, until: untilIso };
    } catch(e) {
      return { ok: false, error: e && e.message };
    }
  }

  async function clearMaintenance() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false };
    try {
      await db.ref(bandPath('calendar_sync_state')).update({
        maintenanceUntil: null,
        maintenanceReason: null
      });
      console.log('[CalSync] Maintenance cleared');
      return { ok: true };
    } catch(e) { return { ok: false, error: e && e.message }; }
  }

  async function getMaintenanceState() {
    return await _readMaintenanceState();
  }

  // Wraps a repair-tool body so maintenance is automatically set on entry and
  // cleared on exit (success OR error). Only enables the gate when apply=true
  // — dry-runs don't write anything, so they don't need the freeze.
  async function _withMaintenance(opts, reason, fn) {
    var apply = !!(opts && opts.apply);
    if (!apply) return await fn();
    var setRes = await setMaintenance(30, reason || 'repair_tool');
    try {
      return await fn();
    } finally {
      try { await clearMaintenance(); } catch(_e) {}
    }
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
    existing.date = _extractLocalDate(startStr) || '';
    var _rawTitle = googleEvent.summary || existing.title || '';
    // Self-heal compounded titles ("Venue — Venue — Venue") and mark dirty
    // so the cleaned version pushes back to Google on the next sync.
    var _cleanRes = _cleanCompoundedTitle(_rawTitle);
    var _titleWasCorrupt = _cleanRes.wasCorrupt;
    if (_titleWasCorrupt) {
      console.log('[CalSync] Cleaned compounded title "' + _rawTitle + '" -> "' + _cleanRes.title + '"');
      _rawTitle = _cleanRes.title;
    }
    existing.title = _rawTitle;
    existing.location = googleEvent.location || existing.location || '';
    existing.notes = googleEvent.description || existing.notes || '';
    existing.isAllDay = isAllDay;
    // Multi-day span → set endDate so _calBuildDateMap expands the event across
    // every covered day. All-day spans use Google's exclusive end date (minus 1);
    // timed spans use the date portion, treating midnight-to-midnight like
    // all-day (end-midnight is effectively the prior day).
    var _startDateR = _extractLocalDate(startStr);
    var _endDateR = _extractLocalDate(endStr);
    if (isAllDay && endStr) {
      var _rEnd = new Date(_endDateR + 'T12:00:00');
      _rEnd.setDate(_rEnd.getDate() - 1);
      var _rEndStr = _rEnd.getFullYear() + '-' + String(_rEnd.getMonth() + 1).padStart(2, '0') + '-' + String(_rEnd.getDate()).padStart(2, '0');
      existing.endDate = _rEndStr > _startDateR ? _rEndStr : '';
    } else if (!isAllDay && endStr && _endDateR > _startDateR) {
      var _rIsEndMid = endStr.length > 10 && _extractLocalHM(endStr) === '00:00';
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
      existing.time = _extractLocalHM(startStr);
      if (endStr.length > 10) existing.endTime = _extractLocalHM(endStr);
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
    // Track recurring relationship so a future PATCH targets the right ID
    // (parent series vs single instance). Currently informational + a
    // warning surface in update(); deeper handling (instance overrides,
    // "edit series vs this only" UX) is queued.
    if (googleEvent.recurringEventId) existing.recurringEventId = googleEvent.recurringEventId;
    if (googleEvent.recurrence && googleEvent.recurrence.length) existing.recurrence = googleEvent.recurrence;
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
    } else if ((existing.type === 'rehearsal' || existing.type === 'gig') && !_epRec.glType) {
      // Auto-DOWNGRADE: an event imported with no glType stamp that's
      // currently typed as rehearsal/gig — re-test the classifier. If the
      // classifier now says 'other' (e.g. negation detected like "Pierce
      // can't rehearse" or "NO Rehearsal Due To Weather"), correct it.
      // GL-stamped events skip this branch — their type is authoritative.
      var _reClassified = _classifyEventType(googleEvent.summary || '');
      if (_reClassified === 'other') {
        var _unCorrect = _detectUnavailability(googleEvent.summary || '');
        if (_unCorrect.isUnavail && _unCorrect.scope !== 'unassigned') {
          console.log('[CalSync] Auto-downgrade: "' + googleEvent.summary + '" was', existing.type, '→ unavailable (' + _unCorrect.members.join(',') + ')');
          existing.type = 'unavailable';
          existing.assignedMembers = _unCorrect.members;
          existing.blockScope = _unCorrect.scope;
        } else if (_unCorrect.isUnavail && _unCorrect.scope === 'band') {
          console.log('[CalSync] Auto-downgrade: "' + googleEvent.summary + '" was', existing.type, '→ band-wide unavailable');
          existing.type = 'unavailable';
          existing.assignedMembers = _unCorrect.members;
          existing.blockScope = 'band';
        } else {
          console.log('[CalSync] Auto-downgrade: "' + googleEvent.summary + '" was', existing.type, '→ other (negation detected, no member match)');
          existing.type = 'other';
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

  // Audit M20 (2026-05-05): D5-class import watchdog. The repair tool
  // `repairCorruptedTitles` is run-once; this returns true for any title
  // that matches the legacy "deadcetera Event" / "Band Event" / generic
  // "Gig" pattern so callers can flag the row before it lands silently.
  // Doesn't block import — just makes the corruption observable on every
  // sync (idempotent watchdog beats one-shot repair).
  function _isSuspiciousImportTitle(title) {
    if (!title) return true;
    var t = String(title).trim();
    if (!t) return true;
    if (/^(deadcetera\s+(event|gig)|band\s+(event|gig)|gig|event)$/i.test(t)) return true;
    // Repeated compound: "X — X — X" patterns that survived the cleaner.
    var parts = t.split(/\s+[—–-]\s+/);
    if (parts.length >= 3) {
      var unique = {};
      parts.forEach(function(p){ unique[p.toLowerCase()] = 1; });
      if (Object.keys(unique).length === 1) return true;
    }
    return false;
  }

  // Build a new GrooveLinx event from a Google event (for first-time imports)
  function _importGoogleEvent(googleEvent, bandCalId) {
    var isAllDay = !!(googleEvent.start && googleEvent.start.date && !googleEvent.start.dateTime);
    var startStr = googleEvent.start ? (googleEvent.start.dateTime || googleEvent.start.date || '') : '';
    var endStr = googleEvent.end ? (googleEvent.end.dateTime || googleEvent.end.date || '') : '';
    // Self-heal compounded titles on first import too (not just reconcile),
    // so newly-discovered "Venue — Venue — Venue" rows don't enter the system
    // corrupt. _titleWasCorruptOnImport flips syncStatus to 'dirty' on the
    // returned record so the cleaned title pushes back to Google.
    var _importClean = _cleanCompoundedTitle(googleEvent.summary || 'Google Event');
    var summary = _importClean.title;
    var _titleWasCorruptOnImport = _importClean.wasCorrupt;
    if (_titleWasCorruptOnImport) {
      console.log('[CalSync] Import: cleaned compounded title -> "' + summary + '" (will mark dirty for write-back)');
    }
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
    var eventTime = (!isAllDay && startStr.length > 10) ? _extractLocalHM(startStr) : '';
    var eventEndTime = (!isAllDay && endStr.length > 10) ? _extractLocalHM(endStr) : '';
    // Multi-day spans: store as single event with endDate so the calendar-grid
    // expansion (in _calBuildDateMap) places the event on every day in range.
    // - All-day: Google's end.date is exclusive → subtract 1 day.
    // - Timed: derive from end.dateTime. Midnight-to-midnight spans are treated
    //   like all-day (the end midnight is effectively the prior day), which
    //   matches how Google's UI renders "Pierce out 6/12–15 midnight-to-midnight"
    //   as a 3-day banner across 6/12, 6/13, 6/14.
    var eventEndDate = '';
    var _startDateOnly = _extractLocalDate(startStr);
    var _endDateOnly = _extractLocalDate(endStr);
    if (isAllDay && endStr) {
      var _endDt = new Date(_endDateOnly + 'T12:00:00');
      _endDt.setDate(_endDt.getDate() - 1); // Google exclusive → inclusive
      var _endInclusive = _endDt.getFullYear() + '-' + String(_endDt.getMonth() + 1).padStart(2, '0') + '-' + String(_endDt.getDate()).padStart(2, '0');
      if (_endInclusive > _startDateOnly) eventEndDate = _endInclusive;
    } else if (!isAllDay && endStr && _endDateOnly > _startDateOnly) {
      // Timed multi-day event. If end is exactly midnight, the effective last
      // day is the day before (Google UI also renders it that way).
      var _isEndMidnight = endStr.length > 10 && _extractLocalHM(endStr) === '00:00';
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
      date: _extractLocalDate(startStr),
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
      // Recurring relationship — informational. PATCH path uses this to
      // log a warning when editing a recurring instance.
      recurringEventId: googleEvent.recurringEventId || null,
      recurrence: (googleEvent.recurrence && googleEvent.recurrence.length) ? googleEvent.recurrence : null,
      _importedFromGoogle: true,
      googleEventId: googleEvent.id,
      calendarId: bandCalId,
      syncStatus: _titleWasCorruptOnImport ? 'dirty' : 'synced',
      lastSyncedAt: new Date().toISOString(),
      sync: { provider: 'google', externalEventId: googleEvent.id, calendarId: bandCalId, status: _titleWasCorruptOnImport ? 'dirty' : 'synced', direction: 'inbound', lastSyncedAt: new Date().toISOString() },
      created: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // ── Sync lock ─────────────────────────────────────────────────────────────
  // Firebase-based soft lock to prevent concurrent syncBandCalendar() runs
  // across devices. Each run acquires the lock with a 180s TTL; other runs
  // see the lock and back off. Prevents the Brian/Drew race where both
  // devices pushed the same event because neither had yet written the
  // googleEventId back to Firebase.
  //
  // Audit M2 (2026-05-04): fail closed with bounded retry. Prior behavior
  // returned true on any Firebase transaction error — meaning a flaky
  // network would let TWO devices think they hold the lock simultaneously.
  // Now: one retry with backoff, then refuse the sync run.
  // Audit M3 (2026-05-04): TTL bumped 60→180s. Full sync + hidden-check +
  // Path B.2 has been observed at 90s+ on slow networks. Old TTL allowed
  // a second device to acquire while first was still writing.
  var LOCK_TTL_MS = 180 * 1000;
  async function _acquireSyncLock() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return true;
    var ref = firebaseDB.ref(bandPath('sync_locks/calendar'));
    var attempt = async function() {
      var result = await ref.transaction(function (curr) {
        var now = Date.now();
        if (curr && curr.expires && curr.expires > now) return; // abort — someone else holds
        return { owner: (typeof currentUserEmail !== 'undefined' ? currentUserEmail : 'unknown'), expires: now + LOCK_TTL_MS };
      });
      return !!result.committed;
    };
    try {
      return await attempt();
    } catch (e) {
      console.warn('[CalSync] lock acquire failed, retrying once in 250ms:', e && e.message);
      await new Promise(function(r){ setTimeout(r, 250); });
      try {
        return await attempt();
      } catch (e2) {
        console.warn('[CalSync] lock acquire retry also failed — refusing sync (fail-closed):', e2 && e2.message);
        return false;
      }
    }
  }
  async function _releaseSyncLock() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return;
    try { await firebaseDB.ref(bandPath('sync_locks/calendar')).remove(); }
    catch (e) { /* non-fatal — lock will expire via TTL */ }
  }

  // Audit M22 (2026-05-04): callers that orchestrate multiple sync-adjacent
  // ops (e.g. _calSyncNow runs reclassify → syncBandCalendar → reclassify)
  // should hold the lock across the WHOLE sequence so another device can't
  // interleave Phase 2 mid-reclassify. These public helpers expose lock
  // ownership; syncBandCalendar will detect the outer lock and skip its
  // own inner acquisition.
  var _externalLockHeld = false;
  async function acquireSyncLock() {
    var got = await _acquireSyncLock();
    if (got) _externalLockHeld = true;
    return got;
  }
  async function releaseSyncLock() {
    _externalLockHeld = false;
    await _releaseSyncLock();
  }

  async function syncBandCalendar() {
    if (!hasCalendarScope()) return { error: 'no scope', pushed: 0, pulled: 0, deleted: 0 };
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) return { error: 'no band calendar configured', pushed: 0, pulled: 0, deleted: 0 };

    // Audit M22 (2026-05-04): if a caller already acquired the lock via
    // acquireSyncLock(), don't try to acquire it again — that would
    // self-deadlock by failing the freshness check.
    var _ownsLock = false;
    if (!_externalLockHeld) {
      var gotLock = await _acquireSyncLock();
      if (!gotLock) {
        console.log('[CalSync] Another device is syncing — skipping this run');
        return { error: 'another_device_syncing', pushed: 0, pulled: 0, deleted: 0, skipped: true };
      }
      _ownsLock = true;
    }
    var _started = Date.now();
    try {
      var _r = await _syncBandCalendarImpl(bandCalId);
      _r._durationMs = Date.now() - _started;
      // Task #13: log sync activity. Non-fatal on failure.
      _logSyncActivity(_r).catch(function(){});
      return _r;
    } finally {
      if (_ownsLock) await _releaseSyncLock();
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
      // Audit M9 (2026-05-04): include row-level detail (first-N event
      // titles+dates+ids) so the Sync Activity modal can show *what* the
      // sync touched, not just *how many*. Cap arrays to keep entries tiny.
      var _trimList = function(list, n) {
        if (!Array.isArray(list)) return [];
        return list.slice(0, n).map(function(it) {
          if (!it) return null;
          return {
            t: (it.title || '').slice(0, 60),
            d: it.date || '',
            id: it.id || it.glEventId || '',
            g: it.googleEventId || ''
          };
        }).filter(Boolean);
      };
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
        partialFetch: !!r.partialFetch,
        skippedNoTitle: r.skippedNoTitle || 0,
        updateErrors: r.updateErrors || 0,
        syntheticsCleared: r.syntheticsCleared || 0,
        // Audit M20 (2026-05-05): D5-class corruption watchdog count + sample.
        suspiciousImports: r.suspiciousImports || 0,
        suspiciousSample: _trimList(r._suspiciousSample, 5),
        error: r.error || null,
        needsReauth: !!r.needsReauth,
        skipped: !!r.skipped,
        skipReason: r.reason || null,
        maintenanceReason: r.maintenanceReason || null,
        maintenanceUntil: r.until || null,
        durationMs: r._durationMs || 0,
        // Row-level detail (first 5 of each list). Lists themselves are
        // populated opportunistically by Phase 1/2; absent → empty.
        pushedSample: _trimList(r._pushedSample, 5),
        pulledSample: _trimList(r._pulledSample, 5),
        updatedSample: _trimList(r._updatedSample, 5),
        deletedSample: _trimList(r._deletedSample, 5)
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
      var busy = cal.busy || [];
      // Audit L4 (2026-05-05): empty busy + partial-scope token is the
      // ambiguous case. Google returns 200 with empty busy when (a) there
      // are genuinely no events, or (b) the token doesn't have freebusy
      // scope on the target calendar. Surface the latter clearly so a
      // band that's quietly missing conflict signal can investigate.
      if (busy.length === 0 && !hasFreeBusyScope()) {
        console.warn('[CalSync] freebusy returned empty AND token lacks freebusy scope —',
          'hidden-event detection is effectively disabled for this session.',
          'Reconnect Google Calendar with full or readonly scope to re-enable Path B.');
      }
      return busy;
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
    // Maintenance gate (audit T1.1): if a migration/repair tool is in progress
    // skip this sync entirely. Prevents D11 (mid-migration sync pushing
    // half-migrated state to Google).
    var _maint = await _readMaintenanceState();
    if (_maint && _maint.active) {
      console.log('[CalSync] === SYNC SKIPPED — maintenance until', _maint.until, '| reason:', _maint.reason || '?');
      return { skipped: true, reason: 'maintenance', until: _maint.until, maintenanceReason: _maint.reason || null, pushed: 0, pulled: 0, updated: 0, deleted: 0 };
    }
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
      // D5 fix (2026-05-04) + Audit M7 (2026-05-04): never push imported
      // "Busy"/"unavailable" rows back to Google when their origin was a
      // PERSONAL calendar (Drew Busy / Brian Busy from members' own cals,
      // imported into calendar_events for conflict-detection). The legacy
      // gate was type-only — too broad: it also blocked legitimately
      // band-cal-authored block/unavailable rows from being pushed.
      // Narrower gate: only short-circuit when the row was imported AND
      // its calendarId is NOT the band cal. A band-cal-authored block
      // (calendarId === bandCalId, or no _importedFromGoogle flag) is
      // free to take the normal CREATE/UPDATE path.
      var _UNTOUCHABLE_TYPE = { unavailable: 1, busy: 1, block: 1 };
      if (ev && ev.type && _UNTOUCHABLE_TYPE[ev.type]) {
        var _isImported = !!ev._importedFromGoogle;
        var _fromOtherCal = !!(ev.calendarId && ev.calendarId !== bandCalId);
        if (_isImported && _fromOtherCal) continue;
        // Also skip if calendarId is missing AND _importedFromGoogle is set —
        // legacy rows without calendarId are still personal-cal imports.
        if (_isImported && !ev.calendarId) continue;
      }
      // T1.2 audit fix: migration-created rows without a real Google event
      // are tagged 'migration_only' so Phase 1 doesn't ghost-push them as
      // fresh outbound. The user can opt in via gig edit (sets dirty=true).
      if (ev && ev.syncStatus === 'migration_only') continue;
      // Audit M8 (2026-05-04): missing-title rows used to be silently dropped.
      // Now we count + log first 5 — visible in sync_activity row detail —
      // so corruption (e.g. cal_event imported from a personal cal with
      // type-only and no title) is observable instead of invisible.
      if (!ev || !ev.date || !ev.title) {
        if (ev && (!ev.date || !ev.title)) {
          result.skippedNoTitle = (result.skippedNoTitle || 0) + 1;
          if (result.skippedNoTitle <= 5) {
            console.warn('[CalSync] Phase 1: skipped row missing required fields —',
              'id=', ev.id || '(none)',
              '| type=', ev.type || '(none)',
              '| title=', JSON.stringify(ev.title),
              '| date=', JSON.stringify(ev.date));
          }
        }
        continue;
      }
      var _gid = ev.googleEventId || (ev.sync && ev.sync.externalEventId);
      var _status = ev.syncStatus || (ev.sync && ev.sync.status) || '';
      // Audit H4 (2026-05-04): rows in 'needs_update', 'error', or 'orphaned'
      // were previously written-but-never-re-evaluated stuck states. Treat
      // them as retry candidates here so they can self-heal.
      // - 'needs_update' / 'error' → upgrade to 'dirty' so the UPDATE branch
      //   below runs.
      // - 'orphaned' → clear the stale googleEventId so the CREATE fall-
      //   through path takes a fresh shot (Phase 1 already handles this
      //   transition mid-loop, but persisting it here makes the row
      //   recoverable on its own next sync).
      if (_gid && (_status === 'needs_update' || _status === 'error')) {
        events[i].syncStatus = 'dirty';
        events[i].sync = events[i].sync || {};
        events[i].sync.status = 'dirty';
        _status = 'dirty';
        dirty = true;
      } else if (_status === 'orphaned') {
        delete events[i].googleEventId;
        if (events[i].sync) delete events[i].sync.externalEventId;
        events[i].syncStatus = '';
        _gid = null;
        _status = '';
        dirty = true;
      }
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
          // Audit M4 (2026-05-04): transient retries now happen inside
          // update() via _withRetry. The legacy outer 400ms single-retry
          // was removed to avoid double-retry budgets stacking.
          // Audit M5 (2026-05-04): surface 401/403 to the sync result so
          // the toast can prompt re-auth instead of leaving the row dirty.
          if (!_upd.success && (_upd.httpStatus === 401 || _upd.httpStatus === 403)) {
            result.needsReauth = true;
            console.warn('[CalSync] Phase 1 UPDATE auth failure (' + _upd.httpStatus + ') — flagging needsReauth and stopping Phase 1');
            break;
          }
          if (_upd.success) {
            events[i].syncStatus = 'synced';
            events[i].lastSyncedAt = new Date().toISOString();
            events[i].sync = events[i].sync || {};
            events[i].sync.status = 'synced';
            events[i].sync.lastSyncedAt = events[i].lastSyncedAt;
            result.pushedUpdates++;
            dirty = true;
            // Audit M9: row-level detail for sync_activity.
            (result._updatedSample = result._updatedSample || []).push({
              title: ev.title, date: ev.date, id: ev.id, googleEventId: _gid
            });
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
          dirty = true;
          // Audit M9: row-level detail.
          (result._pushedSample = result._pushedSample || []).push({
            title: ev.title, date: ev.date, id: ev.id, googleEventId: sync.sync.externalEventId
          });
        } else if (!sync.success && (sync.status === 401 || sync.status === 403)) {
          // Audit M5 (2026-05-04): bubble auth failure so the toast can
          // prompt re-auth. Stop Phase 1 — every subsequent CREATE in this
          // run would 401 too and burn the retry budget for nothing.
          result.needsReauth = true;
          console.warn('[CalSync] Phase 1 CREATE auth failure (' + sync.status + ') — flagging needsReauth and stopping Phase 1');
          break;
        }
      } catch(e) { console.warn('[CalSync] Push failed for', ev.title, e.message); }
    }
    // Audit M6 (2026-05-04): persist BOTH new pushes AND dirty→synced flips
    // before Phase 2 runs. The legacy condition (result.pushed > 0) skipped
    // the save when only UPDATEs happened, leaving the in-memory
    // syncStatus/lastSyncedAt mutations stranded until Phase 2's later save —
    // and if Phase 2 errored mid-flight, those flips were lost.
    // Also persist when self-healing flipped 'needs_update'/'error'/'orphaned'
    // values; we tracked that via the `dirty` flag in the Phase 1 loop.
    if (result.pushed > 0 || result.pushedUpdates > 0 || dirty) {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
      console.log('[CalSync] Phase 1 persisted —',
        'pushed:', result.pushed, '| updates:', result.pushedUpdates || 0, '| selfHealed:', dirty);
      // Reset `dirty` so Phase 2's later save still runs only if it has
      // its own changes to write.
      dirty = false;
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
        // Audit L2 (2026-05-05): first-name match was unconditional, so two
        // members both named "Drew" each pushed the other's blocks. Only
        // allow the first-name fallback when the current user's first name
        // is UNIQUE among active band members. If two share a first name,
        // require ownerKey match OR full-name match.
        var _firstNameUnique = true;
        try {
          if (typeof bandMembers !== 'undefined' && bandMembers && _myFirst) {
            var _shareCount = 0;
            Object.keys(bandMembers).forEach(function(k) {
              var mn = (bandMembers[k] && bandMembers[k].name) || '';
              if (String(mn).toLowerCase().split(' ')[0] === _myFirst) _shareCount++;
            });
            _firstNameUnique = _shareCount <= 1;
          }
        } catch(_e) { /* fail open: keep prior behavior */ }
        console.log('[CalSync] Phase 1.5: match criteria — myKey=', _myKey,
          '| myNameLower=', _myNameLower, '| myFirst=', _myFirst,
          '| firstNameUnique=', _firstNameUnique);
        var _skipReasons = { bad: 0, notMine: 0, alreadySynced: 0 };
        var _notMineLogged = 0;
        for (var bi = 0; bi < blocks.length; bi++) {
          var blk = blocks[bi];
          if (!blk || !blk.blockId || !blk.startDate || !blk.endDate) { _skipReasons.bad++; continue; }
          // Accept ownerKey match OR name match (old blocks stored only
          // ownerName). Match against:
          // - the keyed identifier ("drew")
          // - the full bandMember name ("Drew")
          // - the first word — only when first name is unique in the band
          //   AND the block has no ownerKey (legacy rows); otherwise the
          //   ownerKey wins, end of story.
          var _blkOwnerLower = String(blk.ownerName || '').toLowerCase().trim();
          var _firstNameMatch = _firstNameUnique
            && !blk.ownerKey
            && _blkOwnerLower.split(' ')[0] === _myFirst;
          var _ownedByMe = (blk.ownerKey && blk.ownerKey === _myKey)
            || (blk.ownerName && (
                _blkOwnerLower === _myNameLower
                || _blkOwnerLower === (_myKey || '').toLowerCase()
                || _firstNameMatch
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

    // Audit H15 (2026-05-04): bail before reconcile when partialFetch is set.
    // Running reconcile (and the dedupe pass at Phase 2.4) against an
    // incomplete view risks mis-matching orphans — the page-fetch failure
    // already told us we don't have the full Google state. Phase 1 work
    // already persisted; just skip reconcile and let the next sync retry.
    if (result.partialFetch) {
      console.warn('[CalSync] Phase 2: bailing before reconcile — partialFetch=true, fetched',
        googleEvents.length, 'events but Google returned an error mid-pagination.');
      // Persist Phase-1 dirty→synced flips (which mutated `events` in-memory)
      // but skip the inbound reconcile loop entirely.
      try {
        if (dirty || result.pushedUpdates > 0) {
          await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
        }
      } catch(_e) { console.warn('[CalSync] Phase 2 partial-fetch save failed:', _e && _e.message); }
      return result;
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
          // Audit M9: capture sample BEFORE splice.
          (result._deletedSample = result._deletedSample || []).push({
            title: events[existIdx].title, date: events[existIdx].date,
            id: events[existIdx].id, googleEventId: gEv.id
          });
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
        // Audit M9: row-level detail.
        (result._updatedSample = result._updatedSample || []).push({
          title: events[existIdx].title, date: events[existIdx].date,
          id: events[existIdx].id, googleEventId: gEv.id
        });
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
        // Fallback re-link for orphan locals — same gig was created on
        // another device (no glEventId) so the existing dedupe paths can't
        // bridge it. Match by date + type + (close time OR exact title).
        // Conservative: only re-link when EXACTLY ONE candidate matches, to
        // avoid mismerging two real same-day events.
        var _gIsAllDay = !!(gEv.start && gEv.start.date && !gEv.start.dateTime);
        var _gStart = gEv.start ? (gEv.start.dateTime || gEv.start.date || '') : '';
        var _gDate = _extractLocalDate(_gStart);
        var _gTime = (!_gIsAllDay && _gStart.length > 10) ? _extractLocalHM(_gStart) : '';
        var _glStampedType = (_extProp && _extProp.glType ? _extProp.glType : '').toLowerCase();
        var _gValidTypes = { gig: 1, rehearsal: 1, meeting: 1 };
        var _gType = _gValidTypes[_glStampedType] ? _glStampedType : _classifyEventType(gEv.summary || '');
        var _gTitleNorm = String(gEv.summary || '').trim().toLowerCase();
        if (_gDate && _gValidTypes[_gType]) {
          var _hmToMin = function(hm) { if (!hm) return -1; var p = hm.split(':'); return parseInt(p[0],10)*60 + parseInt(p[1],10); };
          var _candIdxs = [];
          for (var _ci = 0; _ci < events.length; _ci++) {
            var _cand = events[_ci];
            if (!_cand) continue;
            if (_cand.googleEventId || (_cand.sync && _cand.sync.externalEventId)) continue;
            if (_cand._syntheticFromFreeBusy || _cand._deleted) continue;
            if (_cand.date !== _gDate) continue;
            if (_cand.type !== _gType) continue;
            var _timeMatch = false;
            if (_gIsAllDay && (!_cand.time || _cand.isAllDay)) _timeMatch = true;
            else if (_cand.time && _gTime) {
              var _diff = Math.abs(_hmToMin(_cand.time) - _hmToMin(_gTime));
              _timeMatch = _diff >= 0 && _diff <= 60;
            }
            var _titleMatch = _gTitleNorm && _cand.title && String(_cand.title).trim().toLowerCase() === _gTitleNorm;
            if (_timeMatch || _titleMatch) _candIdxs.push(_ci);
          }
          if (_candIdxs.length === 1) {
            var _ti = _candIdxs[0];
            events[_ti].googleEventId = gEv.id;
            events[_ti].sync = events[_ti].sync || {};
            events[_ti].sync.externalEventId = gEv.id;
            // Mark dirty so the next push pass reconciles our local edits
            // (e.g. corrected time) back to Google. Reconcile will skip
            // dirty records, so Google's potentially-stale time won't clobber.
            events[_ti].sync.status = 'dirty';
            events[_ti].syncStatus = 'dirty';
            eventsByGoogleId[gEv.id] = _ti;
            result.updated++;
            dirty = true;
            console.log('[CalSync] Orphan re-link by date+type+time/title: local', events[_ti].id, '<-', gEv.id, '(' + _gDate + ' ' + _gType + ' ' + (_gTime || 'all-day') + ')');
            continue; // skip import — re-linked
          } else if (_candIdxs.length > 1) {
            console.log('[CalSync] Skipping orphan re-link for', gEv.id, '—', _candIdxs.length, 'candidates on', _gDate);
          }
        }
        var newEv = _importGoogleEvent(gEv, bandCalId);
        // Audit M20 (2026-05-05): D5 watchdog. If the title still looks
        // generic/corrupt after the in-import cleaner ran, surface so the
        // band can repair it via the maintenance panel. Non-blocking.
        if (_isSuspiciousImportTitle(newEv.title)) {
          result.suspiciousImports = (result.suspiciousImports || 0) + 1;
          (result._suspiciousSample = result._suspiciousSample || []).push({
            title: newEv.title, date: newEv.date, id: newEv.id, googleEventId: gEv.id
          });
          console.warn('[CalSync] D5 watchdog: imported event with suspicious title —',
            JSON.stringify(newEv.title), '@', newEv.date,
            '(google id:', gEv.id, '). Run repairCorruptedTitles to investigate.');
        }
        events.push(newEv);
        eventsByGoogleId[gEv.id] = events.length - 1;
        result.pulled++;
        dirty = true;
        // Audit M9: row-level detail.
        (result._pulledSample = result._pulledSample || []).push({
          title: newEv.title, date: newEv.date, id: newEv.id, googleEventId: gEv.id
        });
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
      // endDate weighted heavily — for multi-day all-day events, the record
      // that has endDate set is the one Phase 2 reconcile updated. Others
      // are leftover per-day expansions from the old import path. Without
      // this weight, all 6 (or N) per-day records tie on metadata and
      // ties go to lowest index — which is the WRONG one (no endDate).
      var endDateWeight = (e.endDate && e.endDate > (e.date || '')) ? 5 : 0;
      return endDateWeight
        + (e.time ? 1 : 0) + (e.endTime ? 1 : 0) + (e.updated_at ? 1 : 0)
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
      // Remove stale synthetic rows that are no longer in the freebusy output.
      // Audit M10 (2026-05-04): track count for sync_activity log so a clear
      // burst becomes observable in the UI (previously only console).
      var _synthCleared = 0;
      for (var _si = events.length - 1; _si >= 0; _si--) {
        var _sev = events[_si];
        if (_sev && _sev._syntheticFromFreeBusy && !_synthKeys[_sev._hiddenRangeKey]) {
          events.splice(_si, 1);
          _synthDirty = true;
          _synthCleared++;
        }
      }
      if (_synthCleared > 0) {
        result.syntheticsCleared = (result.syntheticsCleared || 0) + _synthCleared;
        console.log('[CalSync] Path B.2: cleared', _synthCleared, 'stale synthetic hidden-event rows');
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

        // ── All-day events: single record with endDate (no per-day expansion) ──
        // Past code expanded multi-day all-day events into one record per day,
        // which made the conflict list show "Drew Busy - Family Reunion in
        // Cape Cod" 8 times for a single 8-day trip. Grid render already
        // expands single records via _calBuildDateMap when endDate is set,
        // so we can store ONE record and color every covered day correctly.
        // Existing per-day records collapse via Phase 2.4 dedupe (same
        // googleEventId).
        if (isAllDay) {
          var _endStr = endStr.substring(0, 10);
          // Google all-day end dates are EXCLUSIVE — subtract 1 day to get
          // inclusive endDate for our local format. DST-safe via setDate.
          var _endParts = _endStr.split('-');
          var _endD = new Date(parseInt(_endParts[0], 10), parseInt(_endParts[1], 10) - 1, parseInt(_endParts[2], 10));
          _endD.setDate(_endD.getDate() - 1);
          var _endInclusive = _endD.getFullYear() + '-' + String(_endD.getMonth() + 1).padStart(2, '0') + '-' + String(_endD.getDate()).padStart(2, '0');
          var _hasMultiDay = _endInclusive > startDate;
          if (_hasMultiDay) {
            console.log('[CalSync] Inbound: importing multi-day event "' + summary + '" as single record (' + startDate + ' \u2192 ' + _endInclusive + ')');
          }
          var _rec = {
            id: _genId(),
            date: startDate,
            endDate: _hasMultiDay ? _endInclusive : '',
            type: inferredType,
            title: summary,
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
    if (!hasCalendarEventsScope()) return { success: false, error: 'no_scope' };
    if (!block) return { success: false, error: 'no_block' };
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
        var _upd = await updateConflictInGoogle(block, opts);
        if (_upd && _upd.status === 'orphan') {
          // Self-heal: stored event ID is stale (deleted from Google directly).
          // Clear the local ID and fall through to the POST path to create a
          // fresh event. Phase 1.5 will pick up the new googleEventId from
          // the success response and persist it.
          console.log('[CalSync] syncConflictToGoogle: orphan googleEventId for block', block.blockId, '— creating fresh event');
          block.googleEventId = null;
        } else {
          return _upd;
        }
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
    // D13 audit fix: never return bare {success:false}. cleanupOrphanGigEvents
    // and similar callers bubble the empty error up as 'unknown'.
    if (!hasCalendarEventsScope()) return { success: false, error: 'no_scope' };
    if (!block) return { success: false, error: 'no_block' };
    if (!block.googleEventId) return { success: false, error: 'no_event_id' };
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
      if (res.status === 404 || res.status === 410) {
        // The googleEventId points to an event that no longer exists on the
        // band calendar (deleted in Google directly). Signal orphan so the
        // caller can clear googleEventId and create a fresh event instead of
        // retrying the same dead ID every sync cycle.
        return { success: false, status: 'orphan', error: 'Event no longer exists on band calendar (' + res.status + ')' };
      }
      if (!res.ok) return { success: false, error: 'Update failed: ' + res.status, status: res.status };
      return { success: true, googleEventId: block.googleEventId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function deleteConflictFromGoogle(googleEventId, opts) {
    // D13 fix: granular gate. calendar.events scope is enough for DELETE.
    // Was over-restricting to hasCalendarScope() which fired false on
    // partial-scope OAuth, leaving cleanupOrphanGigEvents to bubble
    // 'unknown' for every delete. Always return a classified error code.
    if (!hasCalendarEventsScope()) return { success: false, error: 'no_scope' };
    if (!googleEventId) return { success: false, error: 'no_event_id' };
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
      // 2026-05-04 (D4 fix): only zombie-check events whose stored calendarId
      // is the band cal. Events whose googleEventId lives on a member's
      // personal calendar (e.g. type:'unavailable' rows imported via Phase 2
      // inbound or Path B.2 freebusy reflections) cannot be verified through
      // this token — querying them on bandCalId always 404s, which falsely
      // classifies them as zombies. The user "kills" them, sync re-imports
      // them, and we have a perpetual zombie regeneration cycle.
      var evCal = ev.calendarId || (ev.sync && ev.sync.calendarId) || '';
      if (evCal && evCal !== bandCalId) continue;
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
  //
  // Audit L5 (2026-05-05) — when to use which orphan-cleanup tool:
  //   • deduplicateBandCalendar()  → Google-side: same glEventId tag, multiple
  //                                  Google events. Caused by Phase-1 race
  //                                  between two devices. Keeps earliest;
  //                                  deletes the rest from Google.
  //   • mergeOrphanDuplicates()    → Firebase-side: two calendar_events rows
  //                                  for the same actual event (different
  //                                  glEventIds, e.g. Brian/Drew separately
  //                                  pushed). Picks richer one; deletes other.
  //   • cleanupOrphanGigEvents()   → Cross-side: cal_event rows of type:'gig'
  //                                  with no matching gigs/{gigId} record.
  //                                  Drops the orphan cal_event AND its
  //                                  Google twin (used in Stage-1 recovery).
  async function deduplicateBandCalendar() {
    // Audit M17 (2026-05-05): repair tool DELETEs duplicate Google events;
    // needs write scope. hasCalendarScope() (the conflated boolean) was
    // false on partial-scope sessions even when events scope was granted.
    if (!hasCalendarEventsScope()) return { error: 'no scope', removed: 0, groups: 0 };
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
    // Audit M17 (2026-05-05): tool PATCHes Google events; needs write scope.
    if (!hasCalendarEventsScope()) return { error: 'no scope', updated: 0, scanned: 0 };
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

  // ── Merge orphan duplicates ───────────────────────────────────────────────
  // Collapses calendar_events rows that represent the same gig/rehearsal but
  // were created on different devices and never linked. Groups by
  // date + type + normalized venue/title (with self-heal applied to absorb
  // "Venue — Venue — Venue" rows). Keeps the local non-imported row when one
  // exists; otherwise the oldest. Deletes the sibling Google events
  // server-side and removes the sibling rows from Firebase. Marks the keeper
  // dirty so the next push reconciles the correct time back to Google.
  async function mergeOrphanDuplicates() {
    // Audit M17 (2026-05-05): tool DELETEs duplicate Google events; needs write scope.
    if (!hasCalendarEventsScope()) return { error: 'no scope', merged: 0, deleted: 0, scanned: 0 };
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      return { error: 'firebase helpers unavailable', merged: 0, deleted: 0, scanned: 0 };
    }
    var calId = await _getBandCalendarId();
    if (!calId) return { error: 'no band calendar configured', merged: 0, deleted: 0, scanned: 0 };

    var events = [];
    try {
      events = (typeof toArray === 'function')
        ? toArray(await loadBandDataFromDrive('_band', 'calendar_events') || [])
        : [];
    } catch (e) {
      return { error: e.message || 'load failed', merged: 0, deleted: 0, scanned: 0 };
    }

    var validTypes = { gig: 1, rehearsal: 1, meeting: 1 };
    var groups = {};
    events.forEach(function (ev, idx) {
      if (!ev || !ev.date || !validTypes[ev.type]) return;
      if (ev._deleted) return;
      var key = ev.date + '|' + ev.type;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ev: ev, idx: idx });
    });

    var _norm = function (s) {
      return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    };
    var _normVenue = function (ev) {
      return _norm(_cleanCompoundedTitle(ev.venue || '').title);
    };
    var _normTitle = function (ev) {
      return _norm(_cleanCompoundedTitle(ev.title || '').title);
    };
    // Two records on same date+type are "the same event" when ANY of these
    // holds. Time alone is too loose (matinee + evening at same venue would
    // merge); require a name signal.
    //   - normalized titles match exactly
    //   - normalized venues match exactly
    //   - one's venue is a substring of the other's title (or vice versa) —
    //     handles the "deadcetera Gig" local + "Southern Roots Tavern …"
    //     Google twin case
    var _isSameEvent = function (a, b) {
      var aT = _normTitle(a), bT = _normTitle(b);
      var aV = _normVenue(a), bV = _normVenue(b);
      if (aT && bT && aT === bT) return true;
      if (aV && bV && aV === bV) return true;
      if (aV && bT && bT.indexOf(aV) >= 0) return true;
      if (bV && aT && aT.indexOf(bV) >= 0) return true;
      if (aT && bV && aT.indexOf(bV) >= 0) return true;
      if (bT && aV && bT.indexOf(aV) >= 0) return true;
      return false;
    };

    var indicesToRemove = [];
    var pendingDeletes = [];
    var mergedCount = 0;

    Object.keys(groups).forEach(function (groupKey) {
      var members = groups[groupKey];
      if (members.length < 2) return;
      // Union-find over members — two members union when they're plausibly
      // the same event by any of the criteria above. Transitive: if A~B
      // and B~C then {A,B,C} all collapse, even if A and C don't match
      // directly. That's how the 5/30 trio (local "deadcetera Gig" venue
      // SRT, Google "deadcetera Gig", Google "SRT — Southern Roots")
      // collapses through the local record's venue field bridging the two
      // Google rows.
      var parent = members.map(function (_, i) { return i; });
      var find = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      var union = function (i, j) { var ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; };
      for (var i = 0; i < members.length; i++) {
        for (var j = i + 1; j < members.length; j++) {
          if (_isSameEvent(members[i].ev, members[j].ev)) union(i, j);
        }
      }
      var components = {};
      for (var k = 0; k < members.length; k++) {
        var root = find(k);
        if (!components[root]) components[root] = [];
        components[root].push(members[k]);
      }
      Object.keys(components).forEach(function (rootKey) {
        var cluster = components[rootKey];
        if (cluster.length < 2) return;
        cluster.sort(function (a, b) {
          var aImp = a.ev._importedFromGoogle ? 1 : 0;
          var bImp = b.ev._importedFromGoogle ? 1 : 0;
          if (aImp !== bImp) return aImp - bImp;
          var aHasVenue = a.ev.venue ? 1 : 0;
          var bHasVenue = b.ev.venue ? 1 : 0;
          if (aHasVenue !== bHasVenue) return bHasVenue - aHasVenue;
          var aHasTime = a.ev.time ? 1 : 0;
          var bHasTime = b.ev.time ? 1 : 0;
          if (aHasTime !== bHasTime) return bHasTime - aHasTime;
          var ac = Date.parse(a.ev.created || a.ev.updated_at || 0) || 0;
          var bc = Date.parse(b.ev.created || b.ev.updated_at || 0) || 0;
          return ac - bc;
        });
        var keeper = cluster[0].ev;
        var kc = _cleanCompoundedTitle(keeper.title || '');
        if (kc.wasCorrupt) keeper.title = kc.title;
        if (keeper.venue) {
          var vc = _cleanCompoundedTitle(keeper.venue);
          if (vc.wasCorrupt) keeper.venue = vc.title;
        }
        var keeperGid = keeper.googleEventId || (keeper.sync && keeper.sync.externalEventId) || '';
        for (var s = 1; s < cluster.length; s++) {
          var sib = cluster[s].ev;
          var sibGid = sib.googleEventId || (sib.sync && sib.sync.externalEventId) || '';
          if (!keeperGid && sibGid) {
            keeper.googleEventId = sibGid;
            keeper.sync = keeper.sync || {};
            keeper.sync.externalEventId = sibGid;
            keeper.sync.provider = 'google';
            keeper.sync.calendarId = sib.calendarId || calId;
            keeperGid = sibGid;
          } else if (sibGid && sibGid !== keeperGid) {
            pendingDeletes.push({ gid: sibGid });
          }
          indicesToRemove.push(cluster[s].idx);
        }
        keeper.sync = keeper.sync || {};
        keeper.sync.status = 'dirty';
        keeper.syncStatus = 'dirty';
        keeper.updated_at = new Date().toISOString();
        mergedCount++;
        var keeperLbl = _normVenue(keeper) || _normTitle(keeper);
        console.log('[CalSync] mergeOrphanDuplicates: keeping', keeper.id, '(' + keeper.date + ' ' + keeper.type + ' "' + keeperLbl + '") merged ' + (cluster.length - 1) + ' sibling(s)');
      });
    });

    var deletedCount = 0;
    var deleteErrors = 0;
    for (var di = 0; di < pendingDeletes.length; di++) {
      try {
        var rres = await remove(pendingDeletes[di].gid);
        if (rres && rres.success !== false) deletedCount++;
        else deleteErrors++;
      } catch (e) { deleteErrors++; }
    }

    indicesToRemove.sort(function (a, b) { return b - a; });
    var seen = {};
    indicesToRemove.forEach(function (i) {
      if (seen[i]) return;
      seen[i] = 1;
      if (i >= 0 && i < events.length) events.splice(i, 1);
    });

    try {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
    } catch (e) {
      return {
        error: 'save failed: ' + (e.message || ''),
        merged: mergedCount, deleted: deletedCount, deleteErrors: deleteErrors, scanned: events.length
      };
    }

    return {
      merged: mergedCount,
      deleted: deletedCount,
      deleteErrors: deleteErrors,
      removedRows: indicesToRemove.length,
      scanned: events.length
    };
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
      // 2026-05-04 (D10): protect availability data from the purge. Members'
      // personal-cal busy markers (type:'unavailable' or assignedMembers set)
      // are the band's only signal of who's busy when, and they legitimately
      // carry a non-band calendarId. Old purge logic ate them silently on
      // every sync — that's how Brian's busy items disappeared. Keep them.
      var isAvailability = (ev.type === 'unavailable' || ev.type === 'busy' || ev.type === 'block')
        || (Array.isArray(ev.assignedMembers) && ev.assignedMembers.length > 0);
      if (isAvailability) {
        console.log('[CalSync] purge keeping availability row:', ev.date, '|', JSON.stringify(ev.title), '| calId:', evCal || '(none)');
        kept.push(ev);
        return;
      }
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

  // ── D9 (2026-05-04): one-shot title repair ───────────────────────────────
  // Pre-D5, _buildEventBody synthesized "deadcetera Event" for any non-
  // rehearsal/gig/meeting type and Phase 1 push PATCH'd that title back to
  // Google. Result: ~17 of Brian's "Brian busy" rows (and a couple of Drew's)
  // got renamed to "deadcetera Event" both in Firebase and on the band cal.
  // D5 stopped the bug going forward. This function repairs the local rows
  // by reconstructing a sensible title from assignedMembers. Dry-run by
  // default — call with {apply:true} to write changes. Does NOT push to
  // Google (Drew already renamed those manually via Google Calendar UI;
  // pushing again would clobber his fixes).
  async function repairCorruptedTitles(opts) {
    opts = opts || {};
    if (typeof loadBandDataFromDrive !== 'function') {
      return { error: 'firebase helpers unavailable' };
    }
    return await _withMaintenance(opts, 'repairCorruptedTitles', async function() {
      return await _repairCorruptedTitlesImpl(!!opts.apply);
    });
  }

  async function _repairCorruptedTitlesImpl(apply) {
    var raw = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var keyed = !Array.isArray(raw); // Firebase returns an object with push-ids as keys
    var events = (typeof toArray === 'function') ? toArray(raw) : (Array.isArray(raw) ? raw : Object.values(raw));

    function nameFor(memberKey) {
      try {
        if (typeof bandMembers !== 'undefined' && bandMembers && bandMembers[memberKey] && bandMembers[memberKey].name) {
          var first = String(bandMembers[memberKey].name).split(' ')[0];
          if (first) return first;
        }
      } catch(e) {}
      return memberKey.charAt(0).toUpperCase() + memberKey.slice(1);
    }

    function titleFor(ev) {
      var members = Array.isArray(ev.assignedMembers) ? ev.assignedMembers : [];
      // Audit L3 (2026-05-05): bumped cap 5 → 10. The original 5-member
      // ceiling was a heuristic against accidentally rewriting "all-band"
      // events; in practice every active band has ≤ 10 members and a
      // real rehearsal/gig title rarely classifies as a Busy row anyway.
      // 0-member rows still skip — without an attribution we don't know
      // whose name to use, so leave for hand-fix.
      if (members.length === 0 || members.length > 10) return null;
      if (members.length === 1) return nameFor(members[0]) + ' busy';
      return members.map(nameFor).join(', ') + ' busy';
    }

    var proposed = [];
    var skippedAllBand = [];
    events.forEach(function(ev) {
      if (!ev || ev.title !== 'deadcetera Event') return;
      var newTitle = titleFor(ev);
      if (!newTitle) {
        skippedAllBand.push({ date: ev.date, time: ev.time, members: ev.assignedMembers || null, type: ev.type });
        return;
      }
      proposed.push({ id: ev.id, ref: ev, oldTitle: ev.title, newTitle: newTitle, date: ev.date, time: ev.time, members: ev.assignedMembers });
    });

    console.log('[D9] Proposed renames:', proposed.length);
    console.table(proposed.map(function(p) { return { date: p.date, time: p.time, members: JSON.stringify(p.members), oldTitle: p.oldTitle, newTitle: p.newTitle }; }));
    if (skippedAllBand.length) {
      console.warn('[D9] Skipped (5+ members or no members assigned — hand-fix these):', skippedAllBand.length);
      console.table(skippedAllBand);
    }

    if (!apply) {
      console.log('[D9] Dry run only. Run again with {apply:true} to write changes to Firebase.');
      return { proposed: proposed.length, applied: 0, skippedAllBand: skippedAllBand.length, dryRun: true };
    }

    // Apply: mutate the in-memory rows and write back the whole array.
    var nowIso = new Date().toISOString();
    proposed.forEach(function(p) {
      p.ref.title = p.newTitle;
      p.ref.updated_at = nowIso;
      // Mark dirty so a future inbound pull doesn't blow away the repair if
      // Google still has the corrupt title (i.e. Drew hasn't manually renamed
      // that one yet). The sync engine respects updated_at > lastSyncedAt to
      // detect local-newer state.
      if (p.ref.sync) p.ref.sync.status = 'dirty';
      p.ref.syncStatus = 'dirty';
    });
    try {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(events));
      console.log('[D9] ✓ Wrote', proposed.length, 'title repairs to Firebase');
    } catch(e) {
      console.error('[D9] save failed:', e && e.message);
      return { error: 'save_failed', proposed: proposed.length, applied: 0 };
    }
    return { proposed: proposed.length, applied: proposed.length, skippedAllBand: skippedAllBand.length };
  }

  // ── 2026-05-04: stub-recreate hidden events that got deleted from Google ─
  // The 8 dates below had 10pm-12am Brian Busy events that disappeared from
  // the band cal at some prior point (deletion vector unknown — predates
  // today's session). The local synthetic rows will be cleaned up on next
  // sync since they have no backing busy time. This helper recreates them
  // as "Brian busy (please verify)" placeholders with PUBLIC visibility,
  // anchored to America/New_York so they're TZ-correct regardless of where
  // the user runs this. Idempotent — checks for existing stubs first via
  // the glStub=true extended property.
  async function createMissingHiddenStubs(opts) {
    opts = opts || {};
    var dates = opts.dates || [
      '2026-05-15', '2026-05-22', '2026-06-11', '2026-07-15',
      '2026-07-18', '2026-08-12', '2026-10-09', '2026-10-20'
    ];
    var summary = opts.summary || 'Brian busy (please verify)';
    var startTime = opts.startTime || '22:00:00';
    var endTime = opts.endTime || '00:00:00';
    var endNextDay = (opts.endNextDay !== false); // default true (cross-midnight)
    var TZ = opts.timeZone || 'America/New_York';
    var description = opts.description ||
      'Stub recreated 2026-05-04 by GrooveLinx — the original 10pm-midnight event at this slot was deleted from Google Calendar at some prior point. Please confirm this is still a real conflict or delete it if you\'re free.';

    if (!accessToken) { console.warn('[stubs] No accessToken — sign in first.'); return { error: 'no_token' }; }
    var bandCalId = await _getBandCalendarId();
    if (!bandCalId) { console.warn('[stubs] No band calendar configured.'); return { error: 'no_band_cal' }; }
    console.log('[stubs] bandCalId:', bandCalId);
    console.log('[stubs] Local TZ (display only — events anchored to ' + TZ + '):',
      Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Idempotency: query existing stubs by extended property
    var existing = {};
    try {
      var checkUrl = WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId)
        + '&privateExtendedProperty=' + encodeURIComponent('glStub=true')
        + '&timeMin=' + encodeURIComponent(dates[0] + 'T00:00:00Z')
        + '&timeMax=' + encodeURIComponent('2027-01-01T00:00:00Z');
      var checkRes = await fetch(checkUrl, { headers: { 'Authorization': 'Bearer ' + accessToken } });
      if (checkRes.ok) {
        var checkData = await checkRes.json();
        (checkData.items || []).forEach(function(e) {
          var d = ((e.start && (e.start.dateTime || e.start.date)) || '').slice(0, 10);
          if (d) existing[d] = e.id;
        });
      }
    } catch(e) {}
    var existingDates = Object.keys(existing);
    if (existingDates.length) console.log('[stubs] Already-stubbed dates (will skip):', existingDates);

    var results = [];
    for (var i = 0; i < dates.length; i++) {
      var date = dates[i];
      if (existing[date]) { results.push({ date: date, status: 'skipped (already stubbed)', id: existing[date] }); continue; }

      // Compute end date — cross-midnight default
      var endDate = date;
      if (endNextDay) {
        var nx = new Date(date + 'T00:00:00');
        nx.setDate(nx.getDate() + 1);
        endDate = nx.toISOString().slice(0, 10);
      }

      var body = {
        summary: summary,
        description: description,
        start: { dateTime: date + 'T' + startTime, timeZone: TZ },
        end:   { dateTime: endDate + 'T' + endTime, timeZone: TZ },
        visibility: 'public',
        transparency: 'opaque',
        extendedProperties: { private: { groovelinx: 'true', glStub: 'true' } }
      };

      try {
        var res = await fetch(WORKER_BASE + '/calendar/events?calendarId=' + encodeURIComponent(bandCalId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          var data = await res.json();
          results.push({ date: date, status: 'created', id: data.id, link: data.htmlLink });
        } else {
          var txt = await res.text();
          results.push({ date: date, status: 'error ' + res.status, detail: (txt || '').slice(0, 200) });
        }
      } catch(e) {
        results.push({ date: date, status: 'exception', detail: e && e.message });
      }
      await new Promise(function(r) { setTimeout(r, 250); }); // gentle pace
    }

    console.table(results);
    var created = results.filter(function(r) { return r.status === 'created'; }).length;
    var skipped = results.filter(function(r) { return String(r.status).indexOf('skipped') === 0; }).length;
    var errors  = results.filter(function(r) { return r.status !== 'created' && String(r.status).indexOf('skipped') !== 0; }).length;
    console.log('[stubs] Created:', created, '· Skipped:', skipped, '· Errors:', errors);
    return { created: created, skipped: skipped, errors: errors, results: results };
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

  // ── Central gig→cal_event mirror builder (audit T1.3, 2026-05-04) ──────
  // The single legal way to construct a calendar_events row from a gig
  // record. Used by gigs.js _syncGigToCalendar and gl-calendar-sync.js
  // repairGigMirror so they share one truth — eliminates the parallel-mirror
  // class of bugs (D12 was caused by Object.assign({}, gig) spreading
  // gig.linkedSetlist (NAME) into cal_event.linkedSetlist (ID slot)).
  //
  // Inputs: gig record (canonical), existing cal_event row (or null), opts.
  // Output: a fully-formed cal_event row, ready to push/replace in the
  // calendar_events array. Caller still does the array push/replace + save.
  //
  // Preserved-from-existing keys: cal-event-managed metadata that the gig
  // record doesn't track (sync engine state, Google metadata, freebusy
  // synthetics). When existing is null and opts.seedSyncFromGig is true,
  // the gig.sync object is seeded onto the cal_event row so a migration
  // tool's CREATEs don't trigger Phase-1 ghost pushes (D11 prevention).
  //
  // Title resolution: prefer venue (human-readable) over bot-speak. Preserve
  // existing custom titles. Override only when existing is empty, the
  // legacy "deadcetera Gig" string, or already matches the venue.
  function _buildGigCalEventBody(gig, existing, opts) {
    if (!gig) return null;
    opts = opts || {};
    var preservedKeys = ['id', 'googleEventId', 'calendarId', 'sync', 'syncStatus',
      'lastSyncedAt', 'updated_at', '_syntheticFromFreeBusy', '_importedFromGoogle',
      'assignedMembers', 'hiddenInfo', 'organizerEmail', 'recurrence', 'etag'];

    var existingTitle = (existing && existing.title) || '';
    var venueLabel = gig.venue || '';
    var legacyDefaults = /^(deadcetera\s+gig|band\s+gig|gig)$/i;
    var resolvedTitle = (!existingTitle || existingTitle === venueLabel || legacyDefaults.test(existingTitle))
      ? venueLabel
      : existingTitle;

    var preserved = {};
    if (existing) {
      preservedKeys.forEach(function(k) {
        if (existing[k] !== undefined) preserved[k] = existing[k];
      });
    } else if (opts.seedSyncFromGig && gig.sync && gig.sync.externalEventId) {
      // D11 fix: when migrating, seed sync state from the gig record so
      // the next sync sees the row as already-synced and skips Phase-1
      // outbound. Only when there's a real Google event linked.
      preserved.googleEventId = gig.sync.externalEventId;
      preserved.calendarId = gig.sync.calendarId || preserved.calendarId || null;
      preserved.syncStatus = 'synced';
      preserved.lastSyncedAt = gig.sync.lastSyncedAt || new Date().toISOString();
      preserved.sync = {
        provider: gig.sync.provider || 'google',
        externalEventId: gig.sync.externalEventId,
        calendarId: gig.sync.calendarId || null,
        status: 'synced',
        lastSyncedAt: gig.sync.lastSyncedAt || new Date().toISOString(),
        lastSyncDirection: gig.sync.lastSyncDirection || 'migration-link',
        etag: gig.sync.etag || null
      };
    } else if (opts.seedSyncFromGig) {
      // No Google event linked, but it's a migration row — mark migration_only
      // so Phase 1 explicitly skips it instead of treating it as fresh
      // outbound. The user can opt in by editing the gig (sets dirty=true).
      preserved.syncStatus = 'migration_only';
    }

    // CRITICAL (D12 fix): linkedSetlist semantic mismatch — gigs.linkedSetlist
    // holds the setlist NAME, cal_event.linkedSetlist holds the setlist ID.
    // Object.assign({}, gig, ...) would spread the NAME into the ID slot.
    // Override explicitly with gig.setlistId.
    var _now = new Date().toISOString();
    var calRecord = Object.assign({}, gig, preserved, {
      type: 'gig',
      title: resolvedTitle,
      // Audit M11 (2026-05-05): time + startTime are kept paired. Readers
      // can use either; writers MUST set both to the same value.
      time: gig.startTime || '',
      startTime: gig.startTime || '',
      endTime: gig.endTime || '',
      linkedSetlist: gig.setlistId || null,
      // Audit M12 (2026-05-05): updated + updated_at canonicalized — set
      // both atomically. updated_at is the more descriptive name.
      updated: _now,
      updated_at: _now
    });
    _assertCalEventInvariants(calRecord, '_buildGigCalEventBody');
    return calRecord;
  }

  // Audit M11 + M12 + M16 (2026-05-05): runtime invariant check on every
  // cal_event row produced by a known-good builder. A future writer that
  // forgets the linkedSetlist override (D12 sibling) or sets only one of
  // the time/startTime or updated/updated_at pairs will trip a console.warn
  // immediately instead of corrupting Firebase silently. Non-fatal — the
  // write proceeds — but the warning makes the bug visible in dev tools.
  function _assertCalEventInvariants(ev, source) {
    if (!ev) return;
    var src = source || '_assertCalEventInvariants';
    var problems = [];
    if (ev.time !== ev.startTime) {
      problems.push('time/startTime drift: time=' + JSON.stringify(ev.time) + ' startTime=' + JSON.stringify(ev.startTime));
    }
    if (ev.updated !== ev.updated_at) {
      problems.push('updated/updated_at drift: updated=' + JSON.stringify(ev.updated) + ' updated_at=' + JSON.stringify(ev.updated_at));
    }
    if (ev.type === 'gig' && ev.linkedSetlist) {
      // cal_event.linkedSetlist must be a SHORT ID (≤ 24 chars, no spaces).
      // Setlist IDs from generateShortId(12) match /^[A-Za-z0-9_-]{8,24}$/.
      // A space in the value almost certainly means a NAME landed in the
      // ID slot — the D12 corruption pattern.
      var ls = String(ev.linkedSetlist);
      if (ls.indexOf(' ') !== -1 || ls.length > 32) {
        problems.push('linkedSetlist looks like a NAME, not an ID: ' + JSON.stringify(ls).slice(0, 80));
      }
    }
    if (problems.length) {
      console.warn('[CalSync] cal_event invariant violation (' + src + '):',
        ev.id || '(no-id)', ev.title || '(no-title)', '\n  ', problems.join('\n   '));
    }
  }

  // ── Reverse direction: build a gig record from a cal_event (audit T2.9) ───
  // The cal-page editor (calSaveEvent in calendar.js) historically wrote its
  // own gig record inline — a parallel reverse-mirror that bypassed
  // _syncGigToCalendar and dropped fields the gig editor preserves
  // (expenses, availability, _lastCriticalChange, etc.). This helper is the
  // single legal way to translate a cal_event row into a gig-shaped record.
  // Used by calSaveEvent's Phase B1 ("Gig record sync") path.
  //
  // CRITICAL (D12 fix mirror): cal_event.linkedSetlist holds the setlist ID,
  // gigs.linkedSetlist holds the setlist NAME. linkedSl resolution lives in
  // the caller (it has the live setlists array); this helper expects the
  // caller to pass the resolved linkedSl object so the NAME can be set
  // explicitly.
  //
  // Inputs: cal_event row (canonical), existing gig record (or null when
  // creating new), linkedSl (setlist record or null), opts.
  // Output: a gig-shaped object ready to merge with prev / push to gigs.
  function _buildGigFromCalEvent(ev, existingGig, linkedSl, opts) {
    if (!ev) return null;
    opts = opts || {};
    return {
      venueId: ev.venueId || (existingGig && existingGig.venueId) || null,
      venue: ev.venue || ev.title || (existingGig && existingGig.venue) || '',
      date: ev.date || (existingGig && existingGig.date) || '',
      startTime: ev.time || ev.startTime || (existingGig && existingGig.startTime) || '',
      endTime: ev.endTime || (existingGig && existingGig.endTime) || '',
      arrivalTime: ev.arrivalTime || (existingGig && existingGig.arrivalTime) || '',
      soundcheckTime: ev.soundcheckTime || (existingGig && existingGig.soundcheckTime) || '',
      pay: ev.pay || (existingGig && existingGig.pay) || '',
      soundPerson: ev.soundPerson || (existingGig && existingGig.soundPerson) || '',
      contact: ev.contact || (existingGig && existingGig.contact) || '',
      notes: ev.notes || (existingGig && existingGig.notes) || '',
      // linkedSetlist on the GIG side stores the NAME (display string).
      // ev.linkedSetlist on the CAL side stores the ID (D12 invariant).
      // Resolve via the passed-in linkedSl record; fall back to the cal
      // value only if no resolution (matches legacy fall-through but logs).
      linkedSetlist: linkedSl ? (linkedSl.name || '') : (ev.linkedSetlist || ''),
      setlistId: linkedSl ? (linkedSl.setlistId || null) : null,
      updated: new Date().toISOString()
    };
  }

  // ── 2026-05-04: backfill comprehensive gig→calendar_events mirror ────────
  // Stage-1 of the Calendar/Gigs structural merge. Today, calendar_events.gig
  // rows are a partial projection of the gigs node — only ~10 of the gig's
  // ~20 fields get mirrored on save (via _syncGigToCalendar). That's the
  // root of the field-drift bug class: every new gig field added to the
  // schema (e.g. endTime in 4/20, arrival/soundcheck/pay) needs to be
  // explicitly plumbed into _syncGigToCalendar or it silently drops on the
  // mirror side.
  //
  // gigs.js _syncGigToCalendar has been rewritten today to do a FULL-record
  // mirror going forward. This migration walks all existing gigs and
  // backfills the comprehensive mirror onto their matching cal_event rows.
  // After running, every gig field lives on the corresponding cal_event row
  // alongside the calendar-event-managed fields (id, googleEventId, etc).
  //
  // Dry-run by default — call with {apply:true} to write changes.
  // Reports orphans both directions: gigs with no cal_event mirror, and
  // type:'gig' cal_events with no matching gigs record.
  async function repairGigMirror(opts) {
    opts = opts || {};
    var apply = !!opts.apply;
    if (typeof loadBandDataFromDrive !== 'function') {
      return { error: 'firebase helpers unavailable' };
    }

    // Wrap apply path in maintenance gate so a routine sync can't run
    // mid-migration (D11 prevention).
    return await _withMaintenance(opts, 'repairGigMirror', async function() {
      return await _repairGigMirrorImpl(apply);
    });
  }

  async function _repairGigMirrorImpl(apply) {
    var gigs = await loadBandDataFromDrive('_band', 'gigs') || [];
    gigs = (typeof toArray === 'function') ? toArray(gigs) : (Array.isArray(gigs) ? gigs : Object.values(gigs));
    var rawCal = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var calEvents = (typeof toArray === 'function') ? toArray(rawCal) : (Array.isArray(rawCal) ? rawCal : Object.values(rawCal));

    function findCalIdx(gig) {
      var i = -1;
      if (gig.gigId) {
        i = calEvents.findIndex(function(e) { return e && e.type === 'gig' && e.gigId === gig.gigId; });
      }
      if (i < 0 && gig.venue && gig.date) {
        // Exact venue+date match (most common legacy case).
        var key = gig.venue + '|' + gig.date;
        i = calEvents.findIndex(function(e) { return e && e.type === 'gig' && ((e.venue||'') + '|' + (e.date||'')) === key; });
      }
      if (i < 0 && gig.venue && gig.date) {
        // Fuzzy fallback: same date, cal_event.venue starts with gig.venue.
        // Handles legacy rows with mangled venue fields where someone typed
        // a custom title into the venue field, producing strings like
        // "Avon Theater — Grizz Fest" instead of "Avon Theater". The clean
        // gig venue is always a prefix of the mangled cal_event venue.
        i = calEvents.findIndex(function(e) {
          return e && e.type === 'gig' && e.date === gig.date
            && typeof e.venue === 'string' && e.venue.indexOf(gig.venue) === 0
            && !e.gigId; // only consume orphans (no gigId), never steal a row that already belongs to a different gig
        });
      }
      return i;
    }

    function _genId() {
      try { if (typeof generateShortId === 'function') return generateShortId(12); } catch(e) {}
      return 'gl_' + Math.random().toString(36).slice(2, 14);
    }

    var backfilled = []; // existing cal_event row updated with full mirror
    var created = [];    // new cal_event row created (gig had no mirror)
    var orphanCalEvents = []; // type:'gig' cal_event with no matching gig
    var skippedNoVenueOrDate = []; // gigs missing required fields

    gigs.forEach(function(gig) {
      if (!gig || !gig.date || !gig.venue) {
        skippedNoVenueOrDate.push({ gigId: gig && gig.gigId, date: gig && gig.date, venue: gig && gig.venue });
        return;
      }
      var idx = findCalIdx(gig);
      var existing = (idx >= 0) ? calEvents[idx] : null;

      // Centralized builder (T1.3) — single source of truth for the linked
      // setlist override + preserved keys. Pass seedSyncFromGig:true so
      // newly-created mirror rows inherit gig.sync state (T1.2 / D11 fix:
      // prevents Phase-1 ghost pushes after migration).
      var calRecord = _buildGigCalEventBody(gig, existing, { seedSyncFromGig: !existing });
      if (!calRecord.id) calRecord.id = _genId();

      if (idx >= 0) {
        calEvents[idx] = calRecord;
        backfilled.push({ gigId: gig.gigId, date: gig.date, venue: gig.venue, calId: calRecord.id });
      } else {
        calRecord.created = gig.created || new Date().toISOString();
        calEvents.push(calRecord);
        created.push({
          gigId: gig.gigId, date: gig.date, venue: gig.venue, calId: calRecord.id,
          syncStatus: calRecord.syncStatus || '',
          googleEventId: calRecord.googleEventId || null
        });
      }
    });

    // Orphan check: type:'gig' cal_events with no matching gigs record.
    // (Likely from old test data or partially-deleted gigs.)
    calEvents.forEach(function(ev) {
      if (!ev || ev.type !== 'gig') return;
      var match = gigs.find(function(g) {
        if (!g) return false;
        if (ev.gigId && g.gigId === ev.gigId) return true;
        if (g.venue === ev.venue && g.date === ev.date) return true;
        return false;
      });
      if (!match) orphanCalEvents.push({ id: ev.id, gigId: ev.gigId, date: ev.date, venue: ev.venue, title: ev.title });
    });

    console.log('[gigMirror] backfilled (existing cal_event row updated):', backfilled.length);
    if (backfilled.length) console.table(backfilled);
    console.log('[gigMirror] created (new cal_event row from gig):', created.length);
    if (created.length) console.table(created);
    if (orphanCalEvents.length) {
      console.warn('[gigMirror] orphan cal_events (type:gig with no matching gigs row):', orphanCalEvents.length);
      console.table(orphanCalEvents);
    }
    if (skippedNoVenueOrDate.length) {
      console.warn('[gigMirror] skipped gigs missing venue or date:', skippedNoVenueOrDate.length);
      console.table(skippedNoVenueOrDate);
    }

    if (!apply) {
      console.log('[gigMirror] Dry run only. Run again with {apply:true} to write changes.');
      return {
        backfilled: backfilled.length,
        created: created.length,
        orphanCalEvents: orphanCalEvents.length,
        skipped: skippedNoVenueOrDate.length,
        dryRun: true
      };
    }

    try {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(calEvents));
      console.log('[gigMirror] ✓ Wrote', backfilled.length + created.length, 'gig mirrors to calendar_events');
    } catch(e) {
      console.error('[gigMirror] save failed:', e && e.message);
      return { error: 'save_failed', backfilled: backfilled.length, created: created.length, applied: 0 };
    }
    return {
      backfilled: backfilled.length,
      created: created.length,
      applied: backfilled.length + created.length,
      orphanCalEvents: orphanCalEvents.length,
      skipped: skippedNoVenueOrDate.length
    };
  }

  // ── 2026-05-04: cleanup orphan gig cal_events post-repairGigMirror ───────
  // After repairGigMirror runs, any cal_event row with type:'gig' but no
  // gigId is a stale orphan — either a legacy "deadcetera Gig" pure stub
  // with no real venue, or a prefix-duplicate of a real gig (e.g.
  // "Avon Theater — Grizz Fest" alongside the canonical "Avon Theater").
  //
  // Classification (per orphan):
  //   pure_stub        — venue + title both === "deadcetera Gig". Safe to
  //                      delete blindly. Usually has no googleEventId.
  //   prefix_duplicate — same date as a real gig, orphan venue starts with
  //                      gig.venue. Delete locally; if it has its own
  //                      googleEventId, also delete from Google to clean
  //                      up the duplicate Google Calendar entry.
  //   unmatched_orphan — same date as no gig. NEVER deleted — flagged for
  //                      manual investigation.
  //
  // Dry-run by default. Returns counts per classification.
  async function cleanupOrphanGigEvents(opts) {
    opts = opts || {};
    if (typeof loadBandDataFromDrive !== 'function') {
      return { error: 'firebase helpers unavailable' };
    }
    return await _withMaintenance(opts, 'cleanupOrphanGigEvents', async function() {
      return await _cleanupOrphanGigEventsImpl(!!opts.apply);
    });
  }

  async function _cleanupOrphanGigEventsImpl(apply) {

    var rawCal = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var calEvents = (typeof toArray === 'function') ? toArray(rawCal) : (Array.isArray(rawCal) ? rawCal : Object.values(rawCal));
    var rawGigs = await loadBandDataFromDrive('_band', 'gigs') || [];
    var gigs = (typeof toArray === 'function') ? toArray(rawGigs) : (Array.isArray(rawGigs) ? rawGigs : Object.values(rawGigs));

    var orphans = calEvents.filter(function(e) {
      return e && e.type === 'gig' && !e.gigId;
    });

    if (!orphans.length) {
      console.log('[orphanCleanup] No orphan cal_events found.');
      return { found: 0, deletedLocal: 0, deletedGoogle: 0 };
    }

    var classified = orphans.map(function(o) {
      var venue = o.venue || '';
      var title = o.title || '';
      var date = o.date || '';
      var isPureStub = /^deadcetera\s+gig$/i.test(venue) && /^deadcetera\s+gig$/i.test(title);
      var canonicalGig = null;
      var canonicalCalEvent = null;
      if (!isPureStub && date) {
        canonicalGig = gigs.find(function(g) {
          if (!g || !g.date || !g.venue) return false;
          if (g.date !== date) return false;
          return typeof venue === 'string' && venue.indexOf(g.venue) === 0;
        });
        if (canonicalGig) {
          canonicalCalEvent = calEvents.find(function(e) {
            return e && e.type === 'gig' && e.gigId === canonicalGig.gigId;
          });
        }
      }
      return {
        orphan: o,
        isPureStub: isPureStub,
        canonicalGig: canonicalGig,
        canonicalCalEvent: canonicalCalEvent,
        hasGoogleId: !!o.googleEventId,
        reason: isPureStub ? 'pure_stub' :
                canonicalGig ? 'prefix_duplicate' : 'unmatched_orphan'
      };
    });

    console.log('[orphanCleanup] Classified', orphans.length, 'orphans:');
    console.table(classified.map(function(c) {
      return {
        id: c.orphan.id,
        date: c.orphan.date,
        venue: c.orphan.venue,
        title: c.orphan.title,
        reason: c.reason,
        hasGoogleId: c.hasGoogleId,
        googleEventId: c.orphan.googleEventId || null,
        canonicalGigId: c.canonicalGig ? c.canonicalGig.gigId : null,
        canonicalCalId: c.canonicalCalEvent ? c.canonicalCalEvent.id : null
      };
    }));

    var unmatched = classified.filter(function(c) { return c.reason === 'unmatched_orphan'; });
    if (unmatched.length) {
      console.warn('[orphanCleanup] Unmatched orphans (no canonical gig found by date+venue prefix) — NOT deleted, inspect manually:');
      console.table(unmatched.map(function(c) { return { id: c.orphan.id, date: c.orphan.date, venue: c.orphan.venue, title: c.orphan.title }; }));
    }

    var pureStubs = classified.filter(function(c) { return c.reason === 'pure_stub'; });
    var prefixDupes = classified.filter(function(c) { return c.reason === 'prefix_duplicate'; });

    if (!apply) {
      console.log('[orphanCleanup] Dry run only. Would delete', pureStubs.length, 'pure stubs +', prefixDupes.length, 'prefix duplicates locally.');
      var googleEligible = classified.filter(function(c) {
        return (c.reason === 'pure_stub' || c.reason === 'prefix_duplicate') && c.hasGoogleId;
      });
      console.log('[orphanCleanup] Of those,', googleEligible.length, 'have googleEventId — would also attempt Google delete.');
      console.log('[orphanCleanup] Run with {apply:true} to execute.');
      return {
        found: orphans.length,
        pureStubs: pureStubs.length,
        prefixDuplicates: prefixDupes.length,
        unmatched: unmatched.length,
        googleEligible: googleEligible.length,
        dryRun: true
      };
    }

    // Apply path: delete locally + Google. Local delete is a single batch
    // write at the end; Google deletes are per-orphan with per-failure logs.
    var idsToDelete = new Set();
    var deletedGoogle = 0;
    var googleFailures = [];

    for (var i = 0; i < classified.length; i++) {
      var c = classified[i];
      if (c.reason === 'unmatched_orphan') continue;
      idsToDelete.add(c.orphan.id);
      if (c.hasGoogleId) {
        try {
          var delOpts = c.orphan.calendarId ? { calendarId: c.orphan.calendarId } : {};
          var res = await deleteConflictFromGoogle(c.orphan.googleEventId, delOpts);
          if (res && res.success) {
            deletedGoogle++;
            console.log('[orphanCleanup] ✓ Deleted Google event', c.orphan.googleEventId, 'for', c.orphan.date, c.orphan.venue);
          } else {
            googleFailures.push({ id: c.orphan.id, googleEventId: c.orphan.googleEventId, date: c.orphan.date, venue: c.orphan.venue, error: (res && res.error) || 'unknown' });
            console.warn('[orphanCleanup] ✗ Google delete failed:', c.orphan.googleEventId, res && res.error);
          }
        } catch (e) {
          googleFailures.push({ id: c.orphan.id, googleEventId: c.orphan.googleEventId, date: c.orphan.date, venue: c.orphan.venue, error: (e && e.message) || 'exception' });
          console.warn('[orphanCleanup] ✗ Google delete threw:', c.orphan.googleEventId, e && e.message);
        }
      }
    }

    var beforeCount = calEvents.length;
    var newCalEvents = calEvents.filter(function(e) { return !e || !idsToDelete.has(e.id); });
    var deletedLocal = beforeCount - newCalEvents.length;

    try {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(newCalEvents));
      console.log('[orphanCleanup] ✓ Deleted', deletedLocal, 'orphan cal_events from local store');
    } catch (e) {
      console.error('[orphanCleanup] save failed:', e && e.message);
      return { error: 'save_failed', deletedLocal: 0, deletedGoogle: deletedGoogle, googleFailures: googleFailures };
    }

    if (googleFailures.length) {
      console.warn('[orphanCleanup] Google deletes that failed (local rows still removed; clean up these Google events manually):');
      console.table(googleFailures);
    }

    return {
      found: orphans.length,
      pureStubs: pureStubs.length,
      prefixDuplicates: prefixDupes.length,
      unmatched: unmatched.length,
      deletedLocal: deletedLocal,
      deletedGoogle: deletedGoogle,
      googleFailures: googleFailures.length,
      googleFailureDetails: googleFailures
    };
  }

  // ── 2026-05-04: post-mortem repair for broken gig setlist linkage ───────
  // The first repairGigMirror run on prod corrupted cal_event.linkedSetlist
  // by spreading gig.linkedSetlist (a setlist NAME) into cal_event
  // .linkedSetlist (which expects a setlist ID — the dropdown's value).
  // The calendar editor's setlist dropdown couldn't match the name to any
  // setlistId and rendered "-- None --" for every gig. Drew had to
  // manually re-link each gig through the editor.
  //
  // This tool scans every cal_event with type:'gig' + gigId, looks up the
  // matching gig record, and sets cal_event.linkedSetlist = gig.setlistId.
  // Dry-run by default — reports which rows would be repaired without
  // writing. The mirror logic in gigs.js + repairGigMirror has already
  // been patched to set linkedSetlist=gig.setlistId so future runs won't
  // recreate this bug.
  async function fixGigSetlistLinkage(opts) {
    opts = opts || {};
    if (typeof loadBandDataFromDrive !== 'function') {
      return { error: 'firebase helpers unavailable' };
    }
    return await _withMaintenance(opts, 'fixGigSetlistLinkage', async function() {
      return await _fixGigSetlistLinkageImpl(!!opts.apply);
    });
  }

  async function _fixGigSetlistLinkageImpl(apply) {

    var rawCal = await loadBandDataFromDrive('_band', 'calendar_events') || [];
    var calEvents = (typeof toArray === 'function') ? toArray(rawCal) : (Array.isArray(rawCal) ? rawCal : Object.values(rawCal));
    var rawGigs = await loadBandDataFromDrive('_band', 'gigs') || [];
    var gigs = (typeof toArray === 'function') ? toArray(rawGigs) : (Array.isArray(rawGigs) ? rawGigs : Object.values(rawGigs));

    var gigById = {};
    gigs.forEach(function(g) { if (g && g.gigId) gigById[g.gigId] = g; });

    var willRepair = [];
    var alreadyCorrect = [];
    var noGigMatch = [];

    calEvents.forEach(function(ev) {
      if (!ev || ev.type !== 'gig' || !ev.gigId) return;
      var gig = gigById[ev.gigId];
      if (!gig) {
        noGigMatch.push({ calId: ev.id, gigId: ev.gigId, date: ev.date, venue: ev.venue });
        return;
      }
      var current = ev.linkedSetlist || null;
      var correct = gig.setlistId || null;
      if (current === correct) {
        alreadyCorrect.push({ calId: ev.id, gigId: ev.gigId, date: ev.date, venue: ev.venue, setlistId: correct });
      } else {
        willRepair.push({
          calId: ev.id,
          gigId: ev.gigId,
          date: ev.date,
          venue: ev.venue,
          currentLinkedSetlist: current,
          correctSetlistId: correct,
          setlistName: gig.linkedSetlist || null
        });
      }
    });

    console.log('[fixSetlist] cal_events with type:gig + gigId scanned:', willRepair.length + alreadyCorrect.length + noGigMatch.length);
    console.log('[fixSetlist] already correct:', alreadyCorrect.length);
    console.log('[fixSetlist] needs repair:', willRepair.length);
    if (willRepair.length) {
      console.table(willRepair);
    }
    if (noGigMatch.length) {
      console.warn('[fixSetlist] cal_events with gigId but no matching gigs row (skipped, will not repair):', noGigMatch.length);
      console.table(noGigMatch);
    }

    if (!apply) {
      console.log('[fixSetlist] Dry run only. Run with {apply:true} to write changes.');
      return { needsRepair: willRepair.length, alreadyCorrect: alreadyCorrect.length, orphanGigIds: noGigMatch.length, dryRun: true };
    }

    if (!willRepair.length) {
      console.log('[fixSetlist] Nothing to repair.');
      return { needsRepair: 0, alreadyCorrect: alreadyCorrect.length, orphanGigIds: noGigMatch.length, applied: 0 };
    }

    // Apply: in-place mutate the cal_event rows, then save.
    var repairById = {};
    willRepair.forEach(function(r) { repairById[r.calId] = r.correctSetlistId; });

    var nowIso = new Date().toISOString();
    calEvents.forEach(function(ev) {
      if (ev && ev.id && repairById.hasOwnProperty(ev.id)) {
        ev.linkedSetlist = repairById[ev.id];
        ev.updated = nowIso;
      }
    });

    try {
      await saveBandDataToDrive('_band', 'calendar_events', _sanitizeForFirebase(calEvents));
      console.log('[fixSetlist] ✓ Repaired', willRepair.length, 'cal_events');
    } catch (e) {
      console.error('[fixSetlist] save failed:', e && e.message);
      return { error: 'save_failed', applied: 0 };
    }
    return { needsRepair: willRepair.length, alreadyCorrect: alreadyCorrect.length, orphanGigIds: noGigMatch.length, applied: willRepair.length };
  }

  // ── 2026-05-04: bypass-scope direct delete for Google Calendar events ────
  // hasCalendarScope() gates on window._calendarScopeGranted which can be
  // false even when calendar.events scope IS granted (e.g. partial-scope
  // OAuth where 'full' calendar wasn't requested). For one-off cleanup
  // where we already know the user has at least events scope (sync just
  // worked), this helper skips the scope gate and calls the worker proxy
  // directly. Returns per-id status codes so failures are diagnosable.
  async function deleteGoogleEventsDirect(googleEventIds, opts) {
    opts = opts || {};
    if (!Array.isArray(googleEventIds) || !googleEventIds.length) {
      return { error: 'No googleEventIds provided' };
    }
    if (typeof accessToken === 'undefined' || !accessToken) {
      return { error: 'No accessToken — sign in first' };
    }
    var calId = opts.calendarId || (await _getBandCalendarId());
    if (!calId) {
      return { error: 'Could not resolve band calendar id' };
    }

    // M19 audit fix: dry-run by default. Caller must explicitly opt in with
    // {apply:true}. Prior behavior applied immediately on any call — a
    // googleEventId mistakenly fed in could destroy an upcoming gig.
    var apply = !!opts.apply;
    if (!apply) {
      console.log('[directDelete] DRY RUN — would delete', googleEventIds.length, 'events from', calId);
      console.table(googleEventIds.map(function(id) { return { googleEventId: id, action: 'would_delete' }; }));
      console.log('[directDelete] Re-run with {apply:true} to execute.');
      return { dryRun: true, would: googleEventIds.length, calendarId: calId };
    }

    return await _withMaintenance({ apply: true }, 'deleteGoogleEventsDirect', async function() {
      return await _deleteGoogleEventsDirectImpl(googleEventIds, calId);
    });
  }

  async function _deleteGoogleEventsDirectImpl(googleEventIds, calId) {
    console.log('[directDelete] Using calendar:', calId);

    var results = [];
    for (var i = 0; i < googleEventIds.length; i++) {
      var id = googleEventIds[i];
      try {
        var url = WORKER_BASE + '/calendar/events/' + encodeURIComponent(id)
          + '?calendarId=' + encodeURIComponent(calId);
        var res = await fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + accessToken }
        });
        var ok = res.status === 204 || res.status === 410 || res.status === 404;
        results.push({ id: id, status: res.status, success: ok });
        console.log('[directDelete]', id, '→ HTTP', res.status, ok ? '✓' : '✗ (will need manual cleanup)');
      } catch (e) {
        results.push({ id: id, status: 'error', success: false, error: e && e.message });
        console.warn('[directDelete]', id, 'threw:', e && e.message);
      }
    }

    var succeeded = results.filter(function(r) { return r.success; }).length;
    console.log('[directDelete] Done:', succeeded, '/', results.length, 'succeeded');
    return { results: results, succeeded: succeeded, total: results.length };
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    create: create,
    update: update,
    remove: remove,
    hasCalendarScope: hasCalendarScope,
    hasCalendarEventsScope: hasCalendarEventsScope,
    setMaintenance: setMaintenance,
    clearMaintenance: clearMaintenance,
    getMaintenanceState: getMaintenanceState,
    _buildGigCalEventBody: _buildGigCalEventBody,
    _buildGigFromCalEvent: _buildGigFromCalEvent,
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
    acquireSyncLock: acquireSyncLock,
    releaseSyncLock: releaseSyncLock,
    getSyncState: getSyncState,
    runHiddenEventCheck: _runHiddenEventCheck,
    getSyncActivity: getSyncActivity,
    debugMyConfig: debugMyConfig,
    detectAccountDefaultVisibility: detectAccountDefaultVisibility,
    runCalendarHealthCheck: runCalendarHealthCheck,
    auditCalendarPollution: auditCalendarPollution,
    applyAuditDecisions: applyAuditDecisions,
    deduplicateBandCalendar: deduplicateBandCalendar,
    mergeOrphanDuplicates: mergeOrphanDuplicates,
    refreshGigTimesOnGoogle: refreshGigTimesOnGoogle,
    reclassifyUnavailability: reclassifyUnavailability,
    purgeNonBandEvents: purgeNonBandEvents,
    repairCorruptedTitles: repairCorruptedTitles,
    createMissingHiddenStubs: createMissingHiddenStubs,
    repairGigMirror: repairGigMirror,
    cleanupOrphanGigEvents: cleanupOrphanGigEvents,
    fixGigSetlistLinkage: fixGigSetlistLinkage,
    deleteGoogleEventsDirect: deleteGoogleEventsDirect,
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
