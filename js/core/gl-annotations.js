// =============================================================================
// js/core/gl-annotations.js — Phase 1 of the Annotation primitive
//
// Canonical store for the Annotation entity defined in
// 02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md §1.5.
//
// One primitive replaces (eventually) the five+ scattered note storage paths
// (chart_overlay_notes, rehearsal_notes, gig_notes, personal_critique,
// stem_critique_notes, best_shot_section_notes, rehearsal_sessions/comments).
// Phase 1 ships only the primitive + ONE proof-point surface (Song Detail).
// Legacy note paths remain untouched until later phases migrate them.
//
// Storage:
//   bands/{slug}/annotations/{annotationId}
//
// Shape (per spec):
//   {
//     id: string,
//     text: string,
//     anchor: {
//       kind: 'song' | 'rehearsal' | 'recording' | 'take' | 'timestamp'
//             | 'chart' | 'section' | 'stem',
//       song_id?, rehearsal_id?, recording_id?, take_id?,
//       timestamp_sec?, section_name?, chart_line?, stem_id?
//     },
//     tagged_members: string[],   // memberKeys — attention/visibility, NOT ownership
//     author: string,             // memberKey of writer
//     created_at: number,         // ms
//     updated_at: number,         // ms
//     status: 'open' | 'in_progress' | 'fixed' | 'recheck',
//     archived: boolean,          // soft-delete (records stay queryable)
//     task_id?: string            // optional promotion to TaskItem (Phase 4)
//   }
//
// Founder decisions baked in:
//   - tagged_members is attention only; ownership comes via promote-to-task
//   - status defaults to 'open' on create
//   - archived defaults to false (only true on explicit archiveAnnotation)
//
// Indexing: deliberately none yet. Firebase RTDB load-all-and-filter is fine
// at MVP scale. Add an index when annotations/song or annotations/member
// query latency becomes visible.
// =============================================================================

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  var STATUSES = ['open', 'in_progress', 'fixed', 'recheck'];
  var ANCHOR_KINDS = ['song', 'rehearsal', 'recording', 'take', 'timestamp', 'chart', 'section', 'stem'];

  // ── In-memory cache (per session) ─────────────────────────────────────────
  // Loaded once on first read; refreshed on every mutation so subsequent
  // reads see local writes immediately. Other tabs / band members get the
  // update on their next read — no realtime listener yet (Phase 1 keeps it
  // simple; revisit if multi-user concurrency surfaces an issue).
  var _cache = null;          // map of id → annotation
  var _cacheLoadedAt = 0;     // ms timestamp
  var _loadInFlight = null;   // Promise-coalescing flag

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath('annotations' + (suffix ? '/' + suffix : ''));
  }

  function _author() {
    if (typeof getCurrentMemberKey === 'function') {
      var k = getCurrentMemberKey();
      if (k) return k;
    }
    if (typeof currentUserEmail !== 'undefined' && currentUserEmail) {
      return currentUserEmail.split('@')[0];
    }
    return 'unknown';
  }

  function _normalizeAnchor(anchor) {
    var a = anchor || {};
    if (!a.kind || ANCHOR_KINDS.indexOf(a.kind) === -1) {
      throw new Error('[GLAnnotations] anchor.kind required, must be one of: ' + ANCHOR_KINDS.join('|'));
    }
    var out = { kind: a.kind };
    ['song_id', 'rehearsal_id', 'recording_id', 'take_id', 'section_name', 'chart_line', 'stem_id'].forEach(function (f) {
      if (a[f] != null && a[f] !== '') out[f] = a[f];
    });
    if (typeof a.timestamp_sec === 'number' && !isNaN(a.timestamp_sec)) {
      out.timestamp_sec = a.timestamp_sec;
    }
    return out;
  }

  function _normalizeStatus(s) {
    if (!s) return 'open';
    if (STATUSES.indexOf(s) === -1) {
      console.warn('[GLAnnotations] unknown status "' + s + '", defaulting to open');
      return 'open';
    }
    return s;
  }

  function _ensureLoaded(force) {
    if (!force && _cache && (Date.now() - _cacheLoadedAt) < 60000) {
      return Promise.resolve(_cache);
    }
    if (_loadInFlight) return _loadInFlight;
    var db = _db();
    var p = _path('');
    if (!db || !p) {
      _cache = {};
      _cacheLoadedAt = Date.now();
      return Promise.resolve(_cache);
    }
    _loadInFlight = db.ref(p).once('value').then(function (snap) {
      _cache = snap.val() || {};
      _cacheLoadedAt = Date.now();
      _loadInFlight = null;
      return _cache;
    }).catch(function (err) {
      console.warn('[GLAnnotations] load failed:', err && err.message);
      _loadInFlight = null;
      _cache = _cache || {};
      return _cache;
    });
    return _loadInFlight;
  }

  function _matchesAnchor(annotation, filter) {
    if (!filter) return true;
    var a = annotation && annotation.anchor;
    if (!a) return false;
    var keys = Object.keys(filter);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (a[k] !== filter[k]) return false;
    }
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Create — minimal required: text + anchor.kind + at least one anchor target
  function createAnnotation(input) {
    input = input || {};
    var text = (input.text || '').trim();
    if (!text) return Promise.reject(new Error('[GLAnnotations] text required'));
    var anchor = _normalizeAnchor(input.anchor);
    var now = Date.now();
    var annotation = {
      id: '',                  // filled in after push()
      text: text,
      anchor: anchor,
      tagged_members: Array.isArray(input.tagged_members) ? input.tagged_members.slice() : [],
      author: input.author || _author(),
      created_at: now,
      updated_at: now,
      status: _normalizeStatus(input.status),
      archived: false
    };
    if (input.task_id) annotation.task_id = input.task_id;

    var db = _db();
    var p = _path('');
    if (!db || !p) return Promise.reject(new Error('[GLAnnotations] firebase not ready'));

    var ref = db.ref(p).push();
    annotation.id = ref.key;
    return ref.set(annotation).then(function () {
      // Hot-cache the new write so reads don't have to wait for refetch
      if (_cache) _cache[annotation.id] = annotation;
      return annotation;
    });
  }

  // Update — patch existing fields; updated_at always bumps
  function updateAnnotation(id, patch) {
    if (!id) return Promise.reject(new Error('[GLAnnotations] id required'));
    patch = patch || {};
    var db = _db();
    var p = _path(id);
    if (!db || !p) return Promise.reject(new Error('[GLAnnotations] firebase not ready'));

    var safe = {};
    if (typeof patch.text === 'string') safe.text = patch.text.trim();
    if (patch.anchor) safe.anchor = _normalizeAnchor(patch.anchor);
    if (Array.isArray(patch.tagged_members)) safe.tagged_members = patch.tagged_members.slice();
    if (patch.status) safe.status = _normalizeStatus(patch.status);
    if (typeof patch.archived === 'boolean') safe.archived = patch.archived;
    if (typeof patch.task_id === 'string' || patch.task_id === null) safe.task_id = patch.task_id;
    safe.updated_at = Date.now();

    return db.ref(p).update(safe).then(function () {
      if (_cache && _cache[id]) {
        Object.keys(safe).forEach(function (k) { _cache[id][k] = safe[k]; });
      }
      return _cache ? _cache[id] : null;
    });
  }

  // Archive — soft delete; record remains queryable
  function archiveAnnotation(id) {
    return updateAnnotation(id, { archived: true });
  }

  // Unarchive — defensive helper for accidental archives
  function unarchiveAnnotation(id) {
    return updateAnnotation(id, { archived: false });
  }

  // List — generic query by anchor filter (e.g. {kind: 'song', song_id: 'X'})
  function listAnnotationsByAnchor(anchorFilter, opts) {
    opts = opts || {};
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var a = cache[id];
        if (!a) return;
        if (a.archived && !opts.includeArchived) return;
        if (!_matchesAnchor(a, anchorFilter)) return;
        out.push(a);
      });
      // Newest first by default — matches reverse-chron expectation
      out.sort(function (x, y) { return (y.created_at || 0) - (x.created_at || 0); });
      return out;
    });
  }

  // List — by song. Most common Phase 1 query. songId may be a real songs_v2
  // id OR a song title string during the migration window — callers pass
  // whatever identifier they already have for the song.
  function listAnnotationsBySong(songId, opts) {
    if (!songId) return Promise.resolve([]);
    return listAnnotationsByAnchor({ song_id: songId }, opts);
  }

  // List — annotations where memberKey is in tagged_members. Used by the
  // future "My Issues" surface; exposed in Phase 1 so the data contract is
  // stable before the UI ships.
  function listAnnotationsForMember(memberKey, opts) {
    opts = opts || {};
    if (!memberKey) return Promise.resolve([]);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var a = cache[id];
        if (!a) return;
        if (a.archived && !opts.includeArchived) return;
        var tagged = Array.isArray(a.tagged_members) ? a.tagged_members : [];
        if (tagged.indexOf(memberKey) === -1) return;
        out.push(a);
      });
      out.sort(function (x, y) { return (y.created_at || 0) - (x.created_at || 0); });
      return out;
    });
  }

  function listOpenAnnotationsForMember(memberKey, opts) {
    return listAnnotationsForMember(memberKey, opts).then(function (rows) {
      return rows.filter(function (a) { return (a.status || 'open') === 'open' || a.status === 'in_progress' || a.status === 'recheck'; });
    });
  }

  // Force-refresh helper — call after a write that bypassed our writers
  // (e.g. a future migration script). Phase 1 callers shouldn't need this.
  function refreshCache() {
    return _ensureLoaded(true);
  }

  // ── Wire to window ────────────────────────────────────────────────────────
  window.GLAnnotations = {
    // CRUD
    createAnnotation:              createAnnotation,
    updateAnnotation:              updateAnnotation,
    archiveAnnotation:             archiveAnnotation,
    unarchiveAnnotation:           unarchiveAnnotation,
    // Queries
    listAnnotationsByAnchor:       listAnnotationsByAnchor,
    listAnnotationsBySong:         listAnnotationsBySong,
    listAnnotationsForMember:      listAnnotationsForMember,
    listOpenAnnotationsForMember:  listOpenAnnotationsForMember,
    // Cache control
    refreshCache:                  refreshCache,
    // Constants exposed for UI consumers
    STATUSES:                      STATUSES,
    ANCHOR_KINDS:                  ANCHOR_KINDS
  };

  console.log('✅ GLAnnotations initialised');
})();
