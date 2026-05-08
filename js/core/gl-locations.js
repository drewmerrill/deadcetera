// ── Venues + Rehearsal Locations ─────────────────────────────────────────────
//
// Two coupled location concerns sharing the same Drive-backed band-data
// store and load/save helpers:
//
//   1. Venues — gigs/shows/booking destinations. Cached 30s.
//      getVenues / createVenue / findDuplicateVenues / getVenueById.
//
//   2. Rehearsal Locations — practice spaces, virtual meeting links.
//      Cached 60s. getRehearsalLocations / createRehearsalLocation.
//
// Both auto-backfill missing IDs (venueId / locationId) on load.
//
// LOAD ORDER: must come after groovelinx_store.js (uses GLStore.emit).
// Globals firebaseDB / bandPath / generateShortId / loadBandDataFromDrive /
// saveBandDataToDrive / toArray are looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 13) — ~178
// lines, 5 closure-private state vars (_venueCache, _venueCacheTime,
// VENUE_CACHE_TTL, _rehLocCache, _rehLocCacheTime). Local copy of
// _normStr (small/pure) for the duplicate-detection heuristics.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  function _now() { return new Date().toISOString(); }

  function _toArray(x) {
    return (typeof toArray !== 'undefined') ? toArray(x) : (Array.isArray(x) ? x : []);
  }

  function _genShortId(n) {
    return (typeof generateShortId === 'function')
      ? generateShortId(n)
      : Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }

  function _lbdf(songTitle, dataType) {
    if (typeof loadBandDataFromDrive !== 'function') return Promise.resolve(null);
    return loadBandDataFromDrive(songTitle, dataType).catch(function () { return null; });
  }

  function _sbdf(songTitle, dataType, data) {
    if (typeof saveBandDataToDrive !== 'function') return Promise.resolve(null);
    return saveBandDataToDrive(songTitle, dataType, data);
  }

  // Local copy for fuzzy venue-name matching. Store keeps its own copy for
  // gig/setlist matching elsewhere — drift here only affects duplicate
  // venue detection and is harmless.
  function _normStr(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim()
      .replace(/['‘’“”.,!?&()]/g, '')
      .replace(/\btheatre\b/g, 'theater')
      .replace(/\s+/g, ' ')
      .replace(/^the /, '');
  }

  // ── Venues ──

  var _venueCache = null;
  var _venueCacheTime = 0;
  var VENUE_CACHE_TTL = 30000;

  async function getVenues() {
    var now = Date.now();
    if (_venueCache && (now - _venueCacheTime) < VENUE_CACHE_TTL) {
      return _venueCache;
    }
    var venues = _toArray(await _lbdf('_band', 'venues') || []);
    var dirty = false;
    venues.forEach(function(v) {
      if (!v.venueId) {
        v.venueId = _genShortId(12);
        dirty = true;
      }
    });
    if (dirty) {
      await _sbdf('_band', 'venues', venues);
    }
    _venueCache = venues;
    _venueCacheTime = Date.now();
    return venues;
  }

  async function createVenue(data) {
    var venue = {
      venueId: _genShortId(12),
      name: (data.name || '').trim(),
      city: (data.city || '').trim(),
      address: (data.address || '').trim(),
      created: _now()
    };
    var venues = await getVenues();
    venues.push(venue);
    venues.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });
    await _sbdf('_band', 'venues', venues);
    _venueCache = venues;
    _venueCacheTime = Date.now();
    _emit('venueCreated', { venue: venue });
    return venue;
  }

  async function findDuplicateVenues(name) {
    var venues = await getVenues();
    var norm = _normStr(name);
    if (!norm) return [];
    var results = [];
    var normWords = norm.split(' ');
    var firstWord = normWords[0] || '';

    venues.forEach(function(v) {
      var vNorm = _normStr(v.name);
      if (!vNorm) return;

      if (vNorm === norm) {
        results.push({ venue: v, similarity: 'exact', reason: 'Exact match: "' + v.name + '"' });
        return;
      }

      var vWords = vNorm.split(' ');
      if (firstWord.length >= 3 && vWords[0] === firstWord) {
        results.push({ venue: v, similarity: 'likely', reason: 'Similar name: "' + v.name + '"' });
        return;
      }

      if (norm.length >= 4 && (vNorm.indexOf(norm) >= 0 || norm.indexOf(vNorm) >= 0)) {
        var shortLen = Math.min(norm.length, vNorm.length);
        var longLen = Math.max(norm.length, vNorm.length);
        var conf = (shortLen / longLen) >= 0.6 ? 'likely' : 'possible';
        results.push({ venue: v, similarity: conf, reason: 'Similar name: "' + v.name + '"' });
        return;
      }

      if (normWords.length >= 2 && vWords.length >= 2) {
        var wordSet = {};
        normWords.forEach(function(w) { wordSet[w] = true; });
        var intersection = 0;
        vWords.forEach(function(w) { if (wordSet[w]) intersection++; });
        var union = normWords.length + vWords.length - intersection;
        if (union > 0 && (intersection / union) >= 0.6) {
          results.push({ venue: v, similarity: 'possible', reason: 'Similar name: "' + v.name + '"' });
          return;
        }
      }

      if (norm.length >= 4 && vNorm.length >= 4) {
        var shorter = norm.length < vNorm.length ? norm : vNorm;
        var longer = norm.length < vNorm.length ? vNorm : norm;
        var matches = 0;
        for (var i = 0; i < shorter.length; i++) {
          if (longer.indexOf(shorter[i]) >= 0) matches++;
        }
        var ratio = matches / longer.length;
        if (ratio > 0.8 && Math.abs(norm.length - vNorm.length) <= 3) {
          results.push({ venue: v, similarity: 'possible', reason: 'Similar name: "' + v.name + '"' });
        }
      }
    });

    return results;
  }

  function getVenueById(id) {
    if (!id || !_venueCache) return null;
    return _venueCache.find(function(v) { return v.venueId === id; }) || null;
  }

  // ── Rehearsal Locations ──

  var _rehLocCache = null;
  var _rehLocCacheTime = 0;

  async function getRehearsalLocations() {
    var now = Date.now();
    if (_rehLocCache && (now - _rehLocCacheTime) < 60000) return _rehLocCache;
    var locs = _toArray(await _lbdf('_band', 'rehearsal_locations') || []);
    locs.forEach(function(l) {
      if (!l.locationId) l.locationId = _genShortId(12);
    });
    _rehLocCache = locs;
    _rehLocCacheTime = now;
    return locs;
  }

  async function createRehearsalLocation(data) {
    var loc = {
      locationId: _genShortId(12),
      name: (data.name || '').trim(),
      address: (data.address || '').trim(),
      notes: (data.notes || '').trim(),
      meetingLink: (data.meetingLink || '').trim(),
      isVirtual: !!data.isVirtual,
      created: _now()
    };
    var locs = await getRehearsalLocations();
    locs.push(loc);
    locs.sort(function(a,b) { return (a.name||'').localeCompare(b.name||''); });
    await _sbdf('_band', 'rehearsal_locations', locs);
    _rehLocCache = locs;
    _rehLocCacheTime = Date.now();
    return loc;
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.getVenues               = getVenues;
    GL.createVenue             = createVenue;
    GL.findDuplicateVenues     = findDuplicateVenues;
    GL.getVenueById            = getVenueById;
    GL.getRehearsalLocations   = getRehearsalLocations;
    GL.createRehearsalLocation = createRehearsalLocation;
  }
})();
