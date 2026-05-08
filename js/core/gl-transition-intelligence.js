// ── Transition Intelligence ──────────────────────────────────────────────────
//
// Per-pair (fromSong → toSong) confidence + practice tracking. Records
// outcomes ('nailed_it' / 'felt_tighter' / 'still_rough') and adjusts
// confidence on a 0-5 scale. Issue flags capture failure modes
// (timing, entry, groove_lock, count_in).
//
// Persistence: dual-path. Writes to localStorage (glTransitionIntelligence)
// AND Firebase (bandPath/transition_intelligence) on every upsert. Hydrate
// from localStorage at module load; Firebase async overwrite happens after.
//
// Subscriptions:
//   gl-rehearsal-agenda.js subscribes to 'transitionIntelligenceChanged'
//   to invalidate its agenda cache (set up in P1.1 phase 11).
//
// External callers:
//   - js/features/rehearsal.js → saveTransitionPracticeResult
//   - js/features/song-detail.js → getTransitionBySongs
//   - gl-rehearsal-agenda.js (cross-module) → getTransitionIntelligence
//
// LOAD ORDER: must come after groovelinx_store.js. Globals firebaseDB,
// bandPath looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 20) — ~92 lines.
// Lifts _state.transitionIntelligence into module-private _transitionIntel
// (Tier B — drops one key from store's _state object).

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  // ── Module state ──

  var _transitionIntel = {};
  var _STORAGE_KEY = 'glTransitionIntelligence';

  // Hydrate from localStorage (sync). Firebase load below is async.
  try {
    var stored = localStorage.getItem(_STORAGE_KEY);
    if (stored) _transitionIntel = JSON.parse(stored) || {};
  } catch (e) {}

  // Firebase load (async, overwrites localStorage if present)
  if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
    try {
      firebaseDB.ref(bandPath('transition_intelligence')).once('value').then(function(snap) {
        var val = snap.val();
        if (val && typeof val === 'object') {
          _transitionIntel = val;
          try { localStorage.setItem(_STORAGE_KEY, JSON.stringify(val)); } catch (e) {}
        }
      });
    } catch (e) {}
  }

  // ── Helpers ──

  function _makeTransitionKey(fromSongId, toSongId) {
    return (fromSongId || '') + '→' + (toSongId || '');
  }

  function _getDefaultTransitionRecord(fromSongId, toSongId) {
    return {
      key: _makeTransitionKey(fromSongId, toSongId),
      fromSongId: fromSongId,
      toSongId: toSongId,
      linked: true,
      confidence: 2.5,
      targetConfidence: 4.0,
      practiceCount: 0,
      lastPracticedAt: null,
      issueFlags: [],
      notes: '',
      derivedPriority: 0
    };
  }

  function _persist() {
    try {
      localStorage.setItem(_STORAGE_KEY, JSON.stringify(_transitionIntel));
    } catch (e) {}
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try { firebaseDB.ref(bandPath('transition_intelligence')).set(_transitionIntel); } catch (e) {}
    }
  }

  // ── Public API ──

  function getTransitionIntelligence() {
    return _transitionIntel || {};
  }

  function getTransitionBySongs(fromSongId, toSongId) {
    var key = _makeTransitionKey(fromSongId, toSongId);
    return _transitionIntel[key] || _getDefaultTransitionRecord(fromSongId, toSongId);
  }

  function upsertTransitionIntelligence(record) {
    if (!record || !record.key) return;
    _transitionIntel[record.key] = record;
    _persist();
    _emit('transitionIntelligenceChanged', { key: record.key });
  }

  function saveTransitionPracticeResult(payload) {
    if (!payload || !payload.fromSongId || !payload.toSongId) return;
    var key = _makeTransitionKey(payload.fromSongId, payload.toSongId);
    var rec = _transitionIntel[key] || _getDefaultTransitionRecord(payload.fromSongId, payload.toSongId);

    rec.practiceCount = (rec.practiceCount || 0) + 1;
    rec.lastPracticedAt = new Date().toISOString();

    var outcome = payload.outcome || 'still_rough';
    if (outcome === 'nailed_it') rec.confidence = Math.min(5, (rec.confidence || 2.5) + 0.6);
    else if (outcome === 'felt_tighter') rec.confidence = Math.min(5, (rec.confidence || 2.5) + 0.3);
    else if (outcome === 'still_rough') rec.confidence = Math.max(0, (rec.confidence || 2.5) - 0.1);

    if (payload.issueFlags) rec.issueFlags = payload.issueFlags;
    if (payload.notes !== undefined) rec.notes = payload.notes;

    _transitionIntel[key] = rec;
    _persist();
    // gl-rehearsal-agenda subscribes to this event and clears its agenda cache
    _emit('transitionIntelligenceChanged', { key: key, outcome: outcome });
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.getTransitionIntelligence    = getTransitionIntelligence;
    GL.getTransitionBySongs         = getTransitionBySongs;
    GL.upsertTransitionIntelligence = upsertTransitionIntelligence;
    GL.saveTransitionPracticeResult = saveTransitionPracticeResult;
  }
})();
