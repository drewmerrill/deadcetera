// =============================================================================
// js/core/gl-continuity-authority.js — Phase 3G Human Continuity Authority
//
// Durable Firebase-backed analyst decision store for the continuity layer.
// Pure-function continuity logic lives in gl-continuity.js; this module owns
// the side of the system that *remembers* analyst judgments and feeds them
// back into the next continuity pass.
//
// Storage:
//   bands/{slug}/continuity_decisions/{decisionId}
//
// Decision shape:
//   {
//     id,
//     rehearsal_id,
//     decision_type: 'keep_separate' | 'good_merge' | 'ignore_kind',
//     pair_key?,                // for keep_separate / good_merge — canonical
//                               // sorted "segA|segB" string from GLContinuity
//     kind?,                    // suggestion kind this decision targets
//     notes,
//     created_by,
//     created_at,
//     updated_at
//   }
//
// Semantics:
//   keep_separate  — future continuity passes MUST skip this pair_key
//                    regardless of which heuristic suggests it.
//   good_merge     — affirmative human stamp on a merge that already happened.
//                    Doesn't filter; serves as benchmark calibration truth
//                    + UI signal that "this merge has been reviewed."
//   ignore_kind    — disable a specific heuristic kind for this rehearsal
//                    (e.g. turn off all `restart_loop` suggestions because
//                    this band's restarts are intentional separations).
//
// Design rules (per Phase 3G spec):
//   - Lightweight. One action = one decision row. No nesting, no voting.
//   - Reversible. removeDecision restores the prior continuity behavior.
//   - Calibration-mode only. Band members never see these surfaces.
//   - The pure-function gl-continuity.apply() consumes opts.skipPairKeys +
//     opts.ignoredKinds derived here — module boundaries stay clean.
// =============================================================================

(function () {
  'use strict';

  var DECISION_TYPES = ['keep_separate', 'good_merge', 'ignore_kind'];

  var _cache = null;
  var _cacheLoadedAt = 0;
  var _loadInFlight = null;

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath('continuity_decisions' + (suffix ? '/' + suffix : ''));
  }

  function _now() { return Date.now(); }

  function _currentMember() {
    try {
      if (typeof getCurrentMemberKey === 'function') return getCurrentMemberKey() || 'unknown';
    } catch (e) {}
    return 'unknown';
  }

  function _ensureLoaded(force) {
    if (!force && _cache && (_now() - _cacheLoadedAt) < 60000) {
      return Promise.resolve(_cache);
    }
    if (_loadInFlight) return _loadInFlight;
    var db = _db();
    var p = _path('');
    if (!db || !p) {
      _cache = {};
      _cacheLoadedAt = _now();
      return Promise.resolve(_cache);
    }
    _loadInFlight = db.ref(p).once('value').then(function (snap) {
      _cache = snap.val() || {};
      _cacheLoadedAt = _now();
      _loadInFlight = null;
      return _cache;
    }).catch(function (err) {
      console.warn('[GLContinuityAuthority] load failed:', err && err.message);
      _loadInFlight = null;
      _cache = _cache || {};
      return _cache;
    });
    return _loadInFlight;
  }

  // ── Writes ──────────────────────────────────────────────────────────────
  function _addDecision(input) {
    if (!input || !input.rehearsal_id) {
      return Promise.reject(new Error('[GLContinuityAuthority] rehearsal_id required'));
    }
    if (DECISION_TYPES.indexOf(input.decision_type) === -1) {
      return Promise.reject(new Error('[GLContinuityAuthority] unknown decision_type: ' + input.decision_type));
    }
    var db = _db();
    var p = _path('');
    if (!db || !p) return Promise.reject(new Error('[GLContinuityAuthority] firebase not ready'));

    var ref = db.ref(p).push();
    var dec = {
      id: ref.key,
      rehearsal_id: input.rehearsal_id,
      decision_type: input.decision_type,
      pair_key: input.pair_key || null,
      kind: input.kind || null,
      notes: input.notes || '',
      created_by: input.created_by || _currentMember(),
      created_at: _now(),
      updated_at: _now()
    };
    return ref.set(dec).then(function () {
      if (_cache) _cache[dec.id] = dec;
      if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('GLContinuityAuthority', dec.decision_type, {
          rehearsal_id: dec.rehearsal_id,
          pair_key: dec.pair_key,
          kind: dec.kind
        });
      }
      return dec;
    });
  }

  function markKeepSeparate(rehearsalId, pairKey, kind, notes) {
    return _addDecision({
      rehearsal_id: rehearsalId,
      decision_type: 'keep_separate',
      pair_key: pairKey,
      kind: kind || null,
      notes: notes || ''
    });
  }

  function markGoodMerge(rehearsalId, pairKey, kind, notes) {
    return _addDecision({
      rehearsal_id: rehearsalId,
      decision_type: 'good_merge',
      pair_key: pairKey,
      kind: kind || null,
      notes: notes || ''
    });
  }

  function markIgnoreKind(rehearsalId, kind, notes) {
    return _addDecision({
      rehearsal_id: rehearsalId,
      decision_type: 'ignore_kind',
      pair_key: null,
      kind: kind,
      notes: notes || ''
    });
  }

  function removeDecision(id) {
    if (!id) return Promise.reject(new Error('[GLContinuityAuthority] id required'));
    var db = _db();
    var p = _path(id);
    if (!db || !p) return Promise.reject(new Error('[GLContinuityAuthority] firebase not ready'));
    return db.ref(p).remove().then(function () {
      if (_cache) delete _cache[id];
      if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('GLContinuityAuthority', 'decision removed', { id: id });
      }
    });
  }

  // ── Reads ───────────────────────────────────────────────────────────────
  function getDecisionsForSession(rehearsalId) {
    return _ensureLoaded().then(function (cache) {
      var out = [];
      Object.keys(cache || {}).forEach(function (k) {
        var d = cache[k];
        if (d && d.rehearsal_id === rehearsalId) out.push(d);
      });
      out.sort(function (a, b) { return (a.created_at || 0) - (b.created_at || 0); });
      return out;
    });
  }

  function getDecisionForPair(rehearsalId, pairKey) {
    return _ensureLoaded().then(function (cache) {
      var out = null;
      Object.keys(cache || {}).forEach(function (k) {
        var d = cache[k];
        if (!d || d.rehearsal_id !== rehearsalId) return;
        if (d.pair_key !== pairKey) return;
        if (!out || (d.updated_at || 0) > (out.updated_at || 0)) out = d;
      });
      return out;
    });
  }

  // Build the {pairKey: true} skip-map consumed by GLContinuity.apply.
  function computeSkipPairKeys(rehearsalId) {
    return getDecisionsForSession(rehearsalId).then(function (list) {
      var out = {};
      (list || []).forEach(function (d) {
        if (d && d.decision_type === 'keep_separate' && d.pair_key) {
          out[d.pair_key] = true;
        }
      });
      return out;
    });
  }

  function computeIgnoredKinds(rehearsalId) {
    return getDecisionsForSession(rehearsalId).then(function (list) {
      var out = {};
      (list || []).forEach(function (d) {
        if (d && d.decision_type === 'ignore_kind' && d.kind) {
          out[d.kind] = true;
        }
      });
      return out;
    });
  }

  // Roll-up counts for the calibration banner badge.
  function summarizeDecisionsForSession(rehearsalId) {
    return getDecisionsForSession(rehearsalId).then(function (list) {
      var out = { total: 0, keep_separate: 0, good_merge: 0, ignore_kind: 0 };
      (list || []).forEach(function (d) {
        if (!d || !d.decision_type) return;
        out.total++;
        if (out[d.decision_type] !== undefined) out[d.decision_type]++;
      });
      return out;
    });
  }

  // ── Wire to window ──────────────────────────────────────────────────────
  window.GLContinuityAuthority = {
    DECISION_TYPES:               DECISION_TYPES,
    markKeepSeparate:             markKeepSeparate,
    markGoodMerge:                markGoodMerge,
    markIgnoreKind:               markIgnoreKind,
    removeDecision:               removeDecision,
    getDecisionsForSession:       getDecisionsForSession,
    getDecisionForPair:           getDecisionForPair,
    computeSkipPairKeys:          computeSkipPairKeys,
    computeIgnoredKinds:          computeIgnoredKinds,
    summarizeDecisionsForSession: summarizeDecisionsForSession
  };

  console.log('✅ GLContinuityAuthority initialised');
})();
