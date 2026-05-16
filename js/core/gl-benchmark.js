// =============================================================================
// js/core/gl-benchmark.js — Phase 3E Benchmark Calibration Analysis
//
// Founder/admin-only structured failure classification + rerun comparison for
// canonical benchmark rehearsals (the 5/11 stress-test session is the
// reference dataset). This module is the durable layer behind the calibration
// UI; nothing here is exposed to band members.
//
// Storage:
//   bands/{slug}/benchmark_observations/{obsId}
//   bands/{slug}/benchmark_snapshots/{snapshotId}
//
// Observation shape:
//   {
//     id,
//     rehearsal_id,            // FK back to rehearsal_sessions/{sessionId}
//     take_id?,                // optional — null when observation is session-level
//     classification,          // one of CLASSIFICATIONS or 'note'
//     severity,                // 'info' | 'warning' | 'critical'
//     notes,                   // free text — the human truth payload
//     created_by,              // memberKey of the analyst
//     created_at,
//     updated_at
//   }
//
// Snapshot shape:
//   {
//     id,
//     rehearsal_id,
//     build,                   // build version stamp at capture time
//     metrics: {
//       take_count,
//       recording_id_coverage_pct,
//       titled_pct,
//       rid_mismatch_count,
//       human_corrected_count,
//       classified_count
//     },
//     continuity: {
//       adjacent_same_song,
//       restart_loop_candidate,
//       unresolved_cluster,
//       short_take_run
//     },
//     notes,
//     created_by,
//     created_at
//   }
//
// Design rules (per Phase 3E spec):
//   - Observations and snapshots are DURABLE — they survive re-analysis.
//   - No auto-healing, no auto-merge, no auto-classification. Humans only.
//   - No giant dashboards. Compact + inspectable.
//   - Same 60s in-memory cache pattern as gl-annotations / gl-takes /
//     gl-recordings. Load-all-and-filter is fine at MVP scale.
//   - Surfaces only in calibration mode (GLObs.isEnabled()). The module
//     itself loads regardless, so future automation paths can read the
//     same durable truth even when the UI is off.
// =============================================================================

(function () {
  'use strict';

  var CLASSIFICATIONS = [
    'over_split',
    'under_split',
    'wrong_match',
    'false_confidence',
    'transition_confusion',
    'jam_fragmentation',
    'restart_confusion',
    'talking_split',
    'continuity_failure',
    'unresolved_cluster'
  ];

  var _obsCache = null;
  var _obsCacheLoadedAt = 0;
  var _obsLoadInFlight = null;

  var _snapCache = null;
  var _snapCacheLoadedAt = 0;
  var _snapLoadInFlight = null;

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(kind, suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath(kind + (suffix ? '/' + suffix : ''));
  }

  function _now() { return Date.now(); }

  function _currentMember() {
    try {
      if (typeof getCurrentMemberKey === 'function') return getCurrentMemberKey() || 'unknown';
    } catch (e) {}
    return 'unknown';
  }

  function _ensureObsLoaded(force) {
    if (!force && _obsCache && (_now() - _obsCacheLoadedAt) < 60000) {
      return Promise.resolve(_obsCache);
    }
    if (_obsLoadInFlight) return _obsLoadInFlight;
    var db = _db();
    var p = _path('benchmark_observations', '');
    if (!db || !p) {
      _obsCache = {};
      _obsCacheLoadedAt = _now();
      return Promise.resolve(_obsCache);
    }
    _obsLoadInFlight = db.ref(p).once('value').then(function (snap) {
      _obsCache = snap.val() || {};
      _obsCacheLoadedAt = _now();
      _obsLoadInFlight = null;
      return _obsCache;
    }).catch(function (err) {
      console.warn('[GLBenchmark] obs load failed:', err && err.message);
      _obsLoadInFlight = null;
      _obsCache = _obsCache || {};
      return _obsCache;
    });
    return _obsLoadInFlight;
  }

  function _ensureSnapLoaded(force) {
    if (!force && _snapCache && (_now() - _snapCacheLoadedAt) < 60000) {
      return Promise.resolve(_snapCache);
    }
    if (_snapLoadInFlight) return _snapLoadInFlight;
    var db = _db();
    var p = _path('benchmark_snapshots', '');
    if (!db || !p) {
      _snapCache = {};
      _snapCacheLoadedAt = _now();
      return Promise.resolve(_snapCache);
    }
    _snapLoadInFlight = db.ref(p).once('value').then(function (snap) {
      _snapCache = snap.val() || {};
      _snapCacheLoadedAt = _now();
      _snapLoadInFlight = null;
      return _snapCache;
    }).catch(function (err) {
      console.warn('[GLBenchmark] snap load failed:', err && err.message);
      _snapLoadInFlight = null;
      _snapCache = _snapCache || {};
      return _snapCache;
    });
    return _snapLoadInFlight;
  }

  // ── Observations ────────────────────────────────────────────────────────
  function addObservation(input) {
    input = input || {};
    if (!input.rehearsal_id) return Promise.reject(new Error('[GLBenchmark] rehearsal_id required'));
    var classification = input.classification || 'note';
    if (classification !== 'note' && CLASSIFICATIONS.indexOf(classification) === -1) {
      return Promise.reject(new Error('[GLBenchmark] unknown classification: ' + classification));
    }
    var db = _db();
    var p = _path('benchmark_observations', '');
    if (!db || !p) return Promise.reject(new Error('[GLBenchmark] firebase not ready'));

    var ref = db.ref(p).push();
    var obs = {
      id: ref.key,
      rehearsal_id: input.rehearsal_id,
      take_id: input.take_id || null,
      classification: classification,
      severity: input.severity || 'info',
      notes: input.notes || '',
      created_by: input.created_by || _currentMember(),
      created_at: _now(),
      updated_at: _now()
    };
    return ref.set(obs).then(function () {
      if (_obsCache) _obsCache[obs.id] = obs;
      if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('GLBenchmark', 'observation added', {
          rehearsal_id: obs.rehearsal_id,
          take_id: obs.take_id,
          classification: obs.classification,
          severity: obs.severity
        });
      }
      return obs;
    });
  }

  function removeObservation(id) {
    if (!id) return Promise.reject(new Error('[GLBenchmark] id required'));
    var db = _db();
    var p = _path('benchmark_observations', id);
    if (!db || !p) return Promise.reject(new Error('[GLBenchmark] firebase not ready'));
    return db.ref(p).remove().then(function () {
      if (_obsCache) delete _obsCache[id];
      if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('GLBenchmark', 'observation removed', { id: id });
      }
    });
  }

  function getObservationsForSession(rehearsalId) {
    return _ensureObsLoaded().then(function (cache) {
      var out = [];
      Object.keys(cache || {}).forEach(function (k) {
        var o = cache[k];
        if (o && o.rehearsal_id === rehearsalId) out.push(o);
      });
      out.sort(function (a, b) { return (a.created_at || 0) - (b.created_at || 0); });
      return out;
    });
  }

  function getObservationsForTake(takeId) {
    return _ensureObsLoaded().then(function (cache) {
      var out = [];
      Object.keys(cache || {}).forEach(function (k) {
        var o = cache[k];
        if (o && o.take_id === takeId) out.push(o);
      });
      out.sort(function (a, b) { return (a.created_at || 0) - (b.created_at || 0); });
      return out;
    });
  }

  // ── Snapshots ───────────────────────────────────────────────────────────
  function snapshot(rehearsalId, metrics, continuity, notes) {
    if (!rehearsalId) return Promise.reject(new Error('[GLBenchmark] rehearsal_id required'));
    var db = _db();
    var p = _path('benchmark_snapshots', '');
    if (!db || !p) return Promise.reject(new Error('[GLBenchmark] firebase not ready'));

    var build = '';
    try {
      var meta = document.querySelector('meta[name="build-version"]');
      if (meta) build = meta.getAttribute('content') || '';
    } catch (e) {}

    var ref = db.ref(p).push();
    var snap = {
      id: ref.key,
      rehearsal_id: rehearsalId,
      build: build,
      metrics: metrics || {},
      continuity: continuity || {},
      notes: notes || '',
      created_by: _currentMember(),
      created_at: _now()
    };
    return ref.set(snap).then(function () {
      if (_snapCache) _snapCache[snap.id] = snap;
      if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('GLBenchmark', 'snapshot captured', {
          rehearsal_id: rehearsalId,
          build: build,
          metrics: snap.metrics
        });
      }
      return snap;
    });
  }

  function getSnapshotsForSession(rehearsalId) {
    return _ensureSnapLoaded().then(function (cache) {
      var out = [];
      Object.keys(cache || {}).forEach(function (k) {
        var s = cache[k];
        if (s && s.rehearsal_id === rehearsalId) out.push(s);
      });
      out.sort(function (a, b) { return (a.created_at || 0) - (b.created_at || 0); });
      return out;
    });
  }

  // Compute the per-metric delta between two snapshots. Positive numbers mean
  // "later snapshot improved." Improvement direction is hard-coded per metric
  // (more rid coverage = better; fewer mismatches = better; etc.) so the UI
  // can render a single ✓/✗ per row without re-deriving polarity.
  function diffSnapshots(prior, latter) {
    if (!prior || !latter) return null;
    var pm = prior.metrics || {}, lm = latter.metrics || {};
    var pc = prior.continuity || {}, lc = latter.continuity || {};
    function _delta(a, b) { return (Number(b) || 0) - (Number(a) || 0); }
    return {
      build_from: prior.build || '',
      build_to: latter.build || '',
      metrics: {
        take_count:                  { from: pm.take_count, to: lm.take_count, delta: _delta(pm.take_count, lm.take_count), improvement: 'neutral' },
        recording_id_coverage_pct:   { from: pm.recording_id_coverage_pct, to: lm.recording_id_coverage_pct, delta: _delta(pm.recording_id_coverage_pct, lm.recording_id_coverage_pct), improvement: 'higher_better' },
        titled_pct:                  { from: pm.titled_pct, to: lm.titled_pct, delta: _delta(pm.titled_pct, lm.titled_pct), improvement: 'higher_better' },
        rid_mismatch_count:          { from: pm.rid_mismatch_count, to: lm.rid_mismatch_count, delta: _delta(pm.rid_mismatch_count, lm.rid_mismatch_count), improvement: 'lower_better' },
        human_corrected_count:       { from: pm.human_corrected_count, to: lm.human_corrected_count, delta: _delta(pm.human_corrected_count, lm.human_corrected_count), improvement: 'neutral' },
        classified_count:            { from: pm.classified_count, to: lm.classified_count, delta: _delta(pm.classified_count, lm.classified_count), improvement: 'neutral' }
      },
      continuity: {
        adjacent_same_song:          { from: pc.adjacent_same_song, to: lc.adjacent_same_song, delta: _delta(pc.adjacent_same_song, lc.adjacent_same_song), improvement: 'lower_better' },
        restart_loop_candidate:      { from: pc.restart_loop_candidate, to: lc.restart_loop_candidate, delta: _delta(pc.restart_loop_candidate, lc.restart_loop_candidate), improvement: 'lower_better' },
        unresolved_cluster:          { from: pc.unresolved_cluster, to: lc.unresolved_cluster, delta: _delta(pc.unresolved_cluster, lc.unresolved_cluster), improvement: 'lower_better' },
        short_take_run:              { from: pc.short_take_run, to: lc.short_take_run, delta: _delta(pc.short_take_run, lc.short_take_run), improvement: 'lower_better' }
      }
    };
  }

  // Aggregate continuity-signal kinds into a flat count map. Mirrors the
  // categories emitted by GLObs.analyzeTakeContinuity so snapshots and live
  // banners agree on the shape.
  function bucketContinuity(observations) {
    var buckets = { adjacent_same_song: 0, restart_loop_candidate: 0, unresolved_cluster: 0, short_take_run: 0 };
    (observations || []).forEach(function (o) {
      if (!o || !o.kind) return;
      if (buckets[o.kind] !== undefined) buckets[o.kind]++;
    });
    return buckets;
  }

  // ── Wire to window ──────────────────────────────────────────────────────
  window.GLBenchmark = {
    CLASSIFICATIONS:            CLASSIFICATIONS,
    addObservation:             addObservation,
    removeObservation:          removeObservation,
    getObservationsForSession:  getObservationsForSession,
    getObservationsForTake:     getObservationsForTake,
    snapshot:                   snapshot,
    getSnapshotsForSession:     getSnapshotsForSession,
    diffSnapshots:              diffSnapshots,
    bucketContinuity:           bucketContinuity
  };

  console.log('✅ GLBenchmark initialised');
})();
