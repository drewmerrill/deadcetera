// =============================================================================
// js/core/gl-takes.js — Phase 2 of the Rehearsal ↔ Song DNA primitive set
//
// Canonical store for the Take entity defined in
// 02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md §1.4.
//
// A Take is one attempt at one song inside one rehearsal. It promotes the
// transient `audio_segments[]` rows on a rehearsal_session into first-class
// records, so annotations, practice tasks, and future intelligence can hold
// stable foreign keys instead of array indexes that shift every re-analysis.
//
// Phase 2 ships only the primitive + an additive normalization hook on the
// existing segment writers. The legacy
//   rehearsal_sessions/{sessionId}/audio_segments
// path remains the source of truth for the analyzer / timeline UI; takes are
// written ALONGSIDE so downstream consumers (annotations, practice tasks,
// per-song history) can start binding to a stable id.
//
// Storage:
//   bands/{slug}/takes/{takeId}
//
// Shape:
//   {
//     id: string,
//     rehearsal_id: string | null,   // rehearsal_session.sessionId
//     recording_id: string | null,   // rehearsal_recordings entry; null when
//                                    // analysis ran from a transient blob
//     song_id: string | null,        // resolved via getSongByTitle when
//                                    // unambiguous; null during the songs_v2
//                                    // migration window for ambiguous titles
//     song_title: string | null,     // raw label kept for back-compat / debug
//     take_number: number,           // per (rehearsal_id, song_id|title) — 1,2,3...
//     segment_id: string | null,     // backref to the source audio_segments row
//     playback_ref: {
//       recording_id?: string,
//       start_sec: number,
//       end_sec: number
//     },
//     stats: {
//       duration: number,
//       confidence: number,
//       type: string,                // 'song' | 'restart' | 'jam' | ...
//       bpm?: number,
//       groove?: object,
//       chord_summary?: object
//     },
//     created_at: number,
//     updated_at: number
//   }
//
// Founder rules baked in:
//   - take_number is PER REHEARSAL, never global. Two takes of the same song
//     across two rehearsals will both be #1 within their own rehearsal.
//   - Additive only. We never delete or migrate audio_segments[]. A re-analysis
//     can re-write the takes set for that (rehearsal, song) pair via the
//     normalize-from-segments helper.
//   - Title resolution is best-effort. When a song title can't be unambiguously
//     mapped to a songs_v2 id we still write the take with song_id=null and
//     keep song_title populated, so the migration window doesn't drop data.
//
// Indexing: deliberately none yet. Same scaling stance as gl-annotations.js —
// load-all-and-filter is fine at MVP scale; revisit when query latency surfaces.
// =============================================================================

(function () {
  'use strict';

  // ── In-memory cache (per session) ─────────────────────────────────────────
  // Same shape and freshness window as gl-annotations.js: load-once, refresh
  // on local writes, no realtime listener (Phase 2 keeps it simple).
  var _cache = null;          // map of id → take
  var _cacheLoadedAt = 0;     // ms
  var _loadInFlight = null;

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath('takes' + (suffix ? '/' + suffix : ''));
  }

  function _resolveSongId(title) {
    if (!title) return null;
    if (typeof getSongByTitle !== 'function') return null;
    try {
      var s = getSongByTitle(title);
      return (s && s.songId) ? s.songId : null;
    } catch (_e) {
      return null;
    }
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
      console.warn('[GLTakes] load failed:', err && err.message);
      _loadInFlight = null;
      _cache = _cache || {};
      return _cache;
    });
    return _loadInFlight;
  }

  function _normalizeStats(input) {
    var s = input || {};
    var out = {
      duration: typeof s.duration === 'number' ? s.duration : 0,
      confidence: typeof s.confidence === 'number' ? s.confidence : 0,
      type: s.type || 'song'
    };
    if (typeof s.bpm === 'number' && s.bpm > 0) out.bpm = s.bpm;
    if (s.groove && typeof s.groove === 'object') out.groove = s.groove;
    if (s.chord_summary && typeof s.chord_summary === 'object') out.chord_summary = s.chord_summary;
    return out;
  }

  // Canonical Take.matching field — defined in
  // 02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md (Analyzer
  // Matching + Breakpoint Reality Check addendum). Surfaces the matcher's
  // candidate-pool tier, confidence + reason, top-3 suggestions, and whether
  // a human has corrected this take. Take normalization uses
  // correction_source='human' as the protection signal that prevents future
  // auto passes from clobbering a user-assigned song_id.
  var MATCHING_POOLS = ['plan_first', 'broad_library', 'recent_only', 'human', 'unknown'];
  var MATCHING_CONFS = ['high', 'medium', 'low', 'unknown'];
  var MATCHING_SOURCES = ['auto', 'human'];

  function _normalizeMatching(input) {
    if (!input || typeof input !== 'object') return null;
    var pool = MATCHING_POOLS.indexOf(input.candidate_pool) !== -1 ? input.candidate_pool : 'unknown';
    var conf = MATCHING_CONFS.indexOf(input.confidence) !== -1 ? input.confidence : 'unknown';
    var src = MATCHING_SOURCES.indexOf(input.correction_source) !== -1 ? input.correction_source : 'auto';
    var out = {
      candidate_pool: pool,
      confidence: conf,
      correction_source: src
    };
    if (typeof input.confidence_reason === 'string' && input.confidence_reason) {
      out.confidence_reason = input.confidence_reason;
    }
    if (Array.isArray(input.top_suggestions)) {
      out.top_suggestions = input.top_suggestions.slice(0, 3).map(function (s) {
        return {
          title: s && s.title ? s.title : null,
          songId: s && s.songId ? s.songId : null,
          score: typeof (s && s.score) === 'number' ? s.score : null
        };
      });
    } else {
      out.top_suggestions = [];
    }
    return out;
  }

  function _normalizePlaybackRef(input) {
    var pr = input || {};
    var out = {
      start_sec: typeof pr.start_sec === 'number' ? pr.start_sec : 0,
      end_sec: typeof pr.end_sec === 'number' ? pr.end_sec : 0
    };
    if (pr.recording_id) out.recording_id = pr.recording_id;
    return out;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Create a single take. Caller is responsible for take_number — use
  // normalizeRehearsalSegments() for batch writes that need correct numbering.
  function createTake(input) {
    input = input || {};
    var db = _db();
    var p = _path('');
    if (!db || !p) return Promise.reject(new Error('[GLTakes] firebase not ready'));

    var now = Date.now();
    var title = input.song_title || null;
    var songId = (input.song_id != null) ? input.song_id : _resolveSongId(title);

    var matching = _normalizeMatching(input.matching);
    var take = {
      id: '',
      rehearsal_id: input.rehearsal_id || null,
      recording_id: input.recording_id || null,
      song_id: songId,
      song_title: title,
      take_number: typeof input.take_number === 'number' ? input.take_number : 1,
      segment_id: input.segment_id || null,
      playback_ref: _normalizePlaybackRef(input.playback_ref),
      stats: _normalizeStats(input.stats),
      created_at: now,
      updated_at: now
    };
    if (matching) take.matching = matching;
    if (Array.isArray(input.raw_markers)) take.raw_markers = input.raw_markers.slice(0, 16);
    if (input.boundary_confidence) take.boundary_confidence = input.boundary_confidence;

    var ref = db.ref(p).push();
    take.id = ref.key;
    return ref.set(take).then(function () {
      if (_cache) _cache[take.id] = take;
      return take;
    });
  }

  // Patch — only mutable fields. song_title/song_id stay editable so the
  // migration window can backfill song_id once a title becomes resolvable.
  function updateTake(id, patch) {
    if (!id) return Promise.reject(new Error('[GLTakes] id required'));
    patch = patch || {};
    var db = _db();
    var p = _path(id);
    if (!db || !p) return Promise.reject(new Error('[GLTakes] firebase not ready'));

    var safe = {};
    if (typeof patch.song_id === 'string' || patch.song_id === null) safe.song_id = patch.song_id;
    if (typeof patch.song_title === 'string' || patch.song_title === null) safe.song_title = patch.song_title;
    if (typeof patch.recording_id === 'string' || patch.recording_id === null) safe.recording_id = patch.recording_id;
    if (typeof patch.take_number === 'number') safe.take_number = patch.take_number;
    if (patch.playback_ref) safe.playback_ref = _normalizePlaybackRef(patch.playback_ref);
    if (patch.stats) safe.stats = _normalizeStats(patch.stats);
    if (patch.matching) {
      var nm = _normalizeMatching(patch.matching);
      if (nm) safe.matching = nm;
    }
    if (Array.isArray(patch.raw_markers)) safe.raw_markers = patch.raw_markers.slice(0, 16);
    if (typeof patch.boundary_confidence === 'string') safe.boundary_confidence = patch.boundary_confidence;
    safe.updated_at = Date.now();

    // Phase 3B: when a human correction overwrites an existing assignment,
    // auto-capture the prior auto guess into matching.previous_auto_guess.
    // Lets the calibration surface display "analyzer thought X, you said Y"
    // without a separate correction-history store. Read happens from cache —
    // no extra Firebase round-trip.
    if (safe.matching && safe.matching.correction_source === 'human' && _cache && _cache[id]) {
      var prior = _cache[id];
      var priorMatching = prior.matching || {};
      var titleChanging = (typeof safe.song_title === 'string') && safe.song_title !== prior.song_title;
      var idChanging = (typeof safe.song_id === 'string' || safe.song_id === null) && safe.song_id !== prior.song_id;
      var wasAuto = priorMatching.correction_source !== 'human'; // don't stomp the first human guess with a later human guess
      if ((titleChanging || idChanging) && wasAuto && !safe.matching.previous_auto_guess) {
        safe.matching.previous_auto_guess = {
          song_id: prior.song_id || null,
          song_title: prior.song_title || null,
          confidence: priorMatching.confidence || null,
          confidence_reason: priorMatching.confidence_reason || null,
          candidate_pool: priorMatching.candidate_pool || null,
          captured_at: Date.now()
        };
        if (window.GLObs && window.GLObs.log) {
          window.GLObs.log('GLTakes', 'previous_auto_guess captured', {
            takeId: id,
            from: prior.song_title || '(unresolved)',
            to: safe.song_title || '(unresolved)'
          });
        }
      }
    }

    return db.ref(p).update(safe).then(function () {
      if (_cache && _cache[id]) {
        Object.keys(safe).forEach(function (k) { _cache[id][k] = safe[k]; });
      }
      return _cache ? _cache[id] : null;
    });
  }

  function getTake(id, opts) {
    opts = opts || {};
    if (!id) return Promise.resolve(null);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      return cache[id] || null;
    });
  }

  function getTakesForSong(songIdOrTitle, opts) {
    opts = opts || {};
    if (!songIdOrTitle) return Promise.resolve([]);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var t = cache[id];
        if (!t) return;
        if (t.song_id === songIdOrTitle) { out.push(t); return; }
        if (t.song_title === songIdOrTitle) out.push(t);
      });
      out.sort(function (x, y) { return (y.created_at || 0) - (x.created_at || 0); });
      return out;
    });
  }

  function getTakesForRehearsal(rehearsalId, opts) {
    opts = opts || {};
    if (!rehearsalId) return Promise.resolve([]);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var t = cache[id];
        if (!t) return;
        if (t.rehearsal_id === rehearsalId) out.push(t);
      });
      // Earliest first within a rehearsal — matches walk-the-rehearsal order
      out.sort(function (x, y) {
        var ax = (x.playback_ref && x.playback_ref.start_sec) || 0;
        var ay = (y.playback_ref && y.playback_ref.start_sec) || 0;
        return ax - ay;
      });
      return out;
    });
  }

  // Convenience: how many takes of (song_id|title) inside this rehearsal?
  // Used by the per-rehearsal numbering rule.
  function _countTakesInRehearsal(cache, rehearsalId, songId, songTitle) {
    var n = 0;
    Object.keys(cache).forEach(function (id) {
      var t = cache[id];
      if (!t || t.rehearsal_id !== rehearsalId) return;
      if (songId && t.song_id === songId) { n++; return; }
      if (!songId && songTitle && t.song_title === songTitle) n++;
    });
    return n;
  }

  function computeTakeStats(takes) {
    var arr = Array.isArray(takes) ? takes : [];
    var total = arr.length;
    var totalDur = 0;
    var bpms = [];
    var confidences = [];
    arr.forEach(function (t) {
      var s = t.stats || {};
      if (typeof s.duration === 'number') totalDur += s.duration;
      if (typeof s.bpm === 'number' && s.bpm > 0) bpms.push(s.bpm);
      if (typeof s.confidence === 'number') confidences.push(s.confidence);
    });
    bpms.sort(function (a, b) { return a - b; });
    confidences.sort(function (a, b) { return a - b; });
    function _median(a) {
      if (!a.length) return null;
      var mid = Math.floor(a.length / 2);
      return (a.length % 2 === 0) ? (a[mid - 1] + a[mid]) / 2 : a[mid];
    }
    return {
      count: total,
      totalDurationSec: totalDur,
      medianBpm: _median(bpms),
      medianConfidence: _median(confidences)
    };
  }

  // ── Annotation linking helper ─────────────────────────────────────────────
  // Thin convenience wrapper that creates an annotation anchored to this take.
  // We do NOT hold an annotation list on the take itself — annotations live in
  // their own primitive (gl-annotations.js) and are queried by anchor.take_id.
  function attachAnnotation(takeId, annotationInput) {
    if (!takeId) return Promise.reject(new Error('[GLTakes] takeId required'));
    if (typeof window.GLAnnotations === 'undefined' || !window.GLAnnotations.createAnnotation) {
      return Promise.reject(new Error('[GLTakes] GLAnnotations not loaded'));
    }
    var input = annotationInput || {};
    var anchor = Object.assign({}, input.anchor || {});
    anchor.kind = anchor.kind || 'take';
    anchor.take_id = takeId;
    return getTake(takeId).then(function (t) {
      if (t) {
        if (t.rehearsal_id && !anchor.rehearsal_id) anchor.rehearsal_id = t.rehearsal_id;
        if (t.recording_id && !anchor.recording_id) anchor.recording_id = t.recording_id;
        if (t.song_id && !anchor.song_id) anchor.song_id = t.song_id;
      }
      return window.GLAnnotations.createAnnotation({
        text: input.text,
        anchor: anchor,
        tagged_members: input.tagged_members,
        author: input.author,
        status: input.status
      });
    });
  }

  // ── Bulk normalization from segment array ─────────────────────────────────
  // Called by the additive hook on the existing segment writers. Reads the
  // current takes for this rehearsal so we can:
  //   (a) skip segments that already have a take with the same segment_id, and
  //   (b) assign correct per-rehearsal take_number (1-based per song).
  // Returns a Promise<{created: Take[], skipped: number}>.
  function normalizeRehearsalSegments(rehearsalId, segments, opts) {
    opts = opts || {};
    if (!rehearsalId) return Promise.resolve({ created: [], skipped: 0 });
    if (!Array.isArray(segments) || !segments.length) {
      return Promise.resolve({ created: [], skipped: 0 });
    }

    return _ensureLoaded(true).then(function (cache) {
      // Build a fast lookup of existing takes for this rehearsal by segment_id
      var bySegId = {};
      Object.keys(cache).forEach(function (id) {
        var t = cache[id];
        if (t && t.rehearsal_id === rehearsalId && t.segment_id) {
          bySegId[t.segment_id] = t;
        }
      });

      // We tally take_number as we walk segments in chronological order so the
      // numbering is stable regardless of upstream sort.
      var byKeyCount = {}; // (song_id||title) → running count for this rehearsal
      // Seed the running count with takes that already exist
      Object.keys(cache).forEach(function (id) {
        var t = cache[id];
        if (!t || t.rehearsal_id !== rehearsalId) return;
        var k = t.song_id || t.song_title || '__unknown__';
        byKeyCount[k] = Math.max(byKeyCount[k] || 0, t.take_number || 0);
      });

      // Stable chronological order by start_sec
      var ordered = segments.slice().sort(function (a, b) {
        return (a.startSec || 0) - (b.startSec || 0);
      });

      var creates = [];
      var humanProtectedUpdates = [];
      var skipped = 0;
      var protectedFromOverwrite = 0;

      ordered.forEach(function (seg) {
        if (!seg) return;
        // Only normalize music-bearing segments. Talking/false_start/etc stay
        // in the legacy audio_segments path; promoting them isn't useful yet.
        var t = seg.type || seg.segType || 'song';
        if (t === 'talking' || t === 'speech' || t === 'discussion' || t === 'ignore' || t === 'false_start') {
          return;
        }

        var segId = seg.id || null;
        if (segId && bySegId[segId]) {
          // Take already exists for this segment_id. Two cases:
          // (1) Existing take is human-corrected — never auto-clobber song_id /
          //     song_title. We may still patch volatile fields (stats /
          //     boundary_confidence) so analyzer improvements still flow
          //     through, but the song identity is sacred.
          // (2) Existing take is auto — currently a no-op (idempotent). A
          //     future pass can patch matching / stats here when we want
          //     re-analysis to refine confidence.
          var existing = bySegId[segId];
          if (existing && existing.matching && existing.matching.correction_source === 'human') {
            protectedFromOverwrite++;
            // Refresh non-identity metadata only
            var refreshPatch = {};
            if (Array.isArray(seg.raw_markers)) refreshPatch.raw_markers = seg.raw_markers;
            if (seg.boundary_confidence) refreshPatch.boundary_confidence = seg.boundary_confidence;
            if (Object.keys(refreshPatch).length) {
              humanProtectedUpdates.push({ id: existing.id, patch: refreshPatch });
            }
          }
          skipped++;
          return;
        }

        // Honest unresolved policy: when the matcher has explicitly tagged
        // this segment with a low-confidence matching record (or marked it
        // unresolved upstream) we still create a Take so the structural
        // record exists, but we leave song_id null and only carry the
        // tentative title. The full top_suggestions ride along on
        // matching.top_suggestions so a UI surface can present them.
        var title = seg.songTitle || null;
        var matching = seg.matching || null;
        var lowConfidence = matching && matching.confidence === 'low';
        var unresolved = !!seg._unresolved;
        var songId = (lowConfidence || unresolved) ? null : _resolveSongId(title);
        var key = songId || title || '__unknown__';
        byKeyCount[key] = (byKeyCount[key] || 0) + 1;

        creates.push({
          rehearsal_id: rehearsalId,
          recording_id: opts.recording_id || null,
          song_id: songId,
          song_title: title,
          take_number: byKeyCount[key],
          segment_id: segId,
          playback_ref: {
            recording_id: opts.recording_id || undefined,
            start_sec: seg.startSec || 0,
            end_sec: seg.endSec || 0
          },
          stats: {
            duration: seg.duration || ((seg.endSec || 0) - (seg.startSec || 0)),
            confidence: seg.confidence || 0,
            type: t,
            bpm: (typeof seg.bpm === 'number' && seg.bpm > 0) ? seg.bpm : undefined,
            groove: seg.groove || undefined,
            chord_summary: (seg.chordHints && seg.chordHints.summary) ? seg.chordHints.summary : undefined
          },
          matching: matching,
          raw_markers: Array.isArray(seg.raw_markers) ? seg.raw_markers : undefined,
          boundary_confidence: seg.boundary_confidence || undefined
        });
      });

      // Fire the creates and the protected-update refreshes in parallel.
      // Return contract preserved from Phase 2: `created` is the array of new
      // Take rows; `skipped` and `protected` are counts for the existing-take
      // and human-corrected paths respectively.
      var createPromise = Promise.all(creates.map(createTake));
      var refreshPromise = Promise.all(humanProtectedUpdates.map(function (u) {
        return updateTake(u.id, u.patch);
      }));
      return Promise.all([createPromise, refreshPromise]).then(function (results) {
        var result = {
          created: results[0],
          skipped: skipped,
          protected: protectedFromOverwrite
        };
        // Phase 3B observability: structured summary of the normalize pass.
        // Off by default; emits only when calibration mode is on.
        if (window.GLObs && window.GLObs.log) {
          var unresolved = 0;
          (result.created || []).forEach(function (t) {
            if (!t || !t.song_id) unresolved++;
          });
          window.GLObs.log('GLTakes', 'normalize pass', {
            rehearsal_id: rehearsalId,
            created: (result.created || []).length,
            unresolved: unresolved,
            skipped: skipped,
            protected: protectedFromOverwrite,
            segments_in: segments.length
          });
        }
        return result;
      });
    }).catch(function (err) {
      console.warn('[GLTakes] normalize failed:', err && err.message);
      return { created: [], skipped: 0, protected: 0 };
    });
  }

  function refreshCache() {
    return _ensureLoaded(true);
  }

  // ── Wire to window ────────────────────────────────────────────────────────
  window.GLTakes = {
    // CRUD
    createTake:                 createTake,
    updateTake:                 updateTake,
    getTake:                    getTake,
    // Queries
    getTakesForSong:            getTakesForSong,
    getTakesForRehearsal:       getTakesForRehearsal,
    // Composition
    attachAnnotation:           attachAnnotation,
    computeTakeStats:           computeTakeStats,
    // Bulk normalization (called by segment writer hook)
    normalizeRehearsalSegments: normalizeRehearsalSegments,
    // Cache control
    refreshCache:               refreshCache
  };

  console.log('✅ GLTakes initialised');
})();
