// =============================================================================
// js/core/gl-observability.js — Phase 3B Analyzer Calibration + Observability
//
// Founder/admin-only diagnostic layer that exposes WHY the analyzer made the
// decisions it did, without bleeding any of that complexity into band-member
// UX. This module is OFF by default. When enabled, two things change:
//
//   1. Existing console.log calls inside the analyzer pipeline get amplified
//      with grouped, structured payloads instead of stay-on-the-default noise.
//   2. The Phase 3A Take Review card grows a per-row diagnostics block,
//      audio-source diagnostics, and continuity observations.
//
// Three ways to enable calibration mode (any one is sufficient):
//
//   a. URL query param:    ?calibration=1   or   ?cal=1
//   b. localStorage flag:  localStorage.gl_analyzer_calibration = '1'
//   c. Console toggle:     GLObs.enable()   (alias: glCalibrationOn())
//
// To disable: GLObs.disable() / glCalibrationOff() / remove the URL param +
// localStorage entry.
//
// What this module does NOT do (intentional Phase 3B scope):
//
//   - No new UI elements live here (rehearsal.js owns the Take Review card).
//   - No persistence of observations to Firebase (admin-only, local-only).
//   - No realtime listener, no waveform inspection, no DAW visuals.
//   - No continuity ENGINE — just observation. Future phases react to it.
//
// Load order: must load BEFORE gl-takes.js and song_matching_engine.js so
// they can gate their logs on GLObs.isEnabled() at runtime.
// =============================================================================

(function () {
  'use strict';

  var STORAGE_KEY = 'gl_analyzer_calibration';

  function _readUrlFlag() {
    try {
      var qs = new URLSearchParams(window.location.search || '');
      if (qs.get('calibration') === '1' || qs.get('cal') === '1') return true;
    } catch (e) {}
    return false;
  }

  function _readStorageFlag() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  var _enabled = _readStorageFlag() || _readUrlFlag();

  function isEnabled() { return _enabled; }

  function enable() {
    _enabled = true;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    console.log('[GLObs] calibration mode ON — Take Review rows will show diagnostics. Disable: GLObs.disable()');
  }

  function disable() {
    _enabled = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    console.log('[GLObs] calibration mode OFF');
  }

  // Gated log. No-op when calibration mode is off; cheap when on.
  // Convention: log(group, event, payload?) — group is a short tag like
  // 'GLTakes' / 'Matcher' / 'TakeReview'; event is a short verb phrase.
  function log(group, event, payload) {
    if (!_enabled) return;
    try {
      var label = '[' + group + '] ' + event;
      if (payload && typeof payload === 'object') console.log(label, payload);
      else if (payload != null) console.log(label, payload);
      else console.log(label);
    } catch (e) {}
  }

  // Gated console.group wrapper. fn runs unconditionally so callers don't
  // need to branch; only the grouping is gated.
  function groupLog(name, fn) {
    if (!_enabled) { if (typeof fn === 'function') fn(); return; }
    try {
      console.group(name);
      if (typeof fn === 'function') fn();
    } finally {
      try { console.groupEnd(); } catch (e) {}
    }
  }

  // ── Continuity observation helpers ────────────────────────────────────────
  // Observation only — never mutate takes. Returns a small array of
  // {kind, severity, message, evidence: [takeId,...]} entries. The Take
  // Review card surfaces these as compact banner items when calibration mode
  // is on; future continuity engines (Phase 4+) will react to them.
  //
  // Kinds emitted today:
  //   adjacent_same_song      — same song_id on consecutive takes (split risk)
  //   unresolved_cluster      — 3+ consecutive takes without a song
  //   restart_loop_candidate  — 2 adjacent unresolved takes sharing top-2+ suggestions
  //   short_take_run          — 4+ consecutive takes < 60s (likely fragmenting)
  function analyzeTakeContinuity(takes) {
    if (!Array.isArray(takes) || takes.length < 2) return [];
    var sorted = takes.slice().sort(function (a, b) {
      var ax = (a.playback_ref && a.playback_ref.start_sec) || 0;
      var ay = (b.playback_ref && b.playback_ref.start_sec) || 0;
      return ax - ay;
    });
    var obs = [];

    // Adjacent same-song split signal
    for (var i = 1; i < sorted.length; i++) {
      var p = sorted[i - 1], c = sorted[i];
      var pId = p.song_id || (p.song_title ? 'title:' + p.song_title : null);
      var cId = c.song_id || (c.song_title ? 'title:' + c.song_title : null);
      if (pId && cId && pId === cId) {
        obs.push({
          kind: 'adjacent_same_song',
          severity: 'observation',
          message: 'Adjacent takes share song: ' + (p.song_title || p.song_id),
          evidence: [p.id, c.id]
        });
      }
    }

    // Unresolved clusters
    var run = 0, runStart = -1;
    for (var j = 0; j < sorted.length; j++) {
      var unresolved = !sorted[j].song_id && !sorted[j].song_title;
      if (unresolved) {
        if (run === 0) runStart = j;
        run++;
      } else {
        if (run >= 3) {
          obs.push({
            kind: 'unresolved_cluster',
            severity: 'warning',
            message: run + ' consecutive unresolved takes',
            evidence: sorted.slice(runStart, runStart + run).map(function (t) { return t.id; })
          });
        }
        run = 0; runStart = -1;
      }
    }
    if (run >= 3) {
      obs.push({
        kind: 'unresolved_cluster',
        severity: 'warning',
        message: run + ' consecutive unresolved takes',
        evidence: sorted.slice(runStart, runStart + run).map(function (t) { return t.id; })
      });
    }

    // Restart-loop candidates (two unresolved takes share most of their top suggestions)
    for (var k = 1; k < sorted.length; k++) {
      var pp = sorted[k - 1], cc = sorted[k];
      if (pp.song_id || cc.song_id) continue;
      var ppTops = ((pp.matching || {}).top_suggestions || []).map(function (s) { return s && s.title; }).filter(Boolean);
      var ccTops = ((cc.matching || {}).top_suggestions || []).map(function (s) { return s && s.title; }).filter(Boolean);
      if (ppTops.length < 2 || ccTops.length < 2) continue;
      var shared = ppTops.filter(function (t) { return ccTops.indexOf(t) !== -1; }).length;
      if (shared >= 2) {
        obs.push({
          kind: 'restart_loop_candidate',
          severity: 'observation',
          message: 'Two consecutive unresolved takes share ' + shared + ' top suggestions',
          evidence: [pp.id, cc.id]
        });
      }
    }

    // Short-take fragmentation (4+ consecutive takes < 60s suggests over-splitting)
    var shortRun = 0, shortRunStart = -1;
    for (var m = 0; m < sorted.length; m++) {
      var dur = (sorted[m].stats && sorted[m].stats.duration) || 0;
      if (dur > 0 && dur < 60) {
        if (shortRun === 0) shortRunStart = m;
        shortRun++;
      } else {
        if (shortRun >= 4) {
          obs.push({
            kind: 'short_take_run',
            severity: 'observation',
            message: shortRun + ' consecutive takes under 60s — possible over-splitting',
            evidence: sorted.slice(shortRunStart, shortRunStart + shortRun).map(function (t) { return t.id; })
          });
        }
        shortRun = 0; shortRunStart = -1;
      }
    }
    if (shortRun >= 4) {
      obs.push({
        kind: 'short_take_run',
        severity: 'observation',
        message: shortRun + ' consecutive takes under 60s — possible over-splitting',
        evidence: sorted.slice(shortRunStart, shortRunStart + shortRun).map(function (t) { return t.id; })
      });
    }

    return obs;
  }

  // ── Audio source summary ──────────────────────────────────────────────────
  // Surfaces playback-identity diagnostics that today's UI hides. Phase 3A
  // only knows about session.recording_url; mixdown lookup is deferred —
  // this summary reports that gap explicitly when calibration mode is on.
  function summarizeAudioSource(session) {
    var url = (session && session.recording_url) || '';
    var isBlob = !!(url && url.indexOf('blob:') === 0);
    var hasPersistent = !!(url && !isBlob);
    var origin = 'none';
    if (url) {
      if (isBlob) origin = 'session_blob';
      else if (url.indexOf('drive.google') !== -1) origin = 'google_drive';
      else if (url.indexOf('storage.googleapis') !== -1) origin = 'gcs';
      else if (url.indexOf('http') === 0) origin = 'http';
      else origin = 'unknown';
    }
    // Phase 3C: mixdown lookup is now available via GLRecordings.
    // resolvePlaybackSource — calibration banner shows resolver result above
    // this snapshot. Note text reflects the new state.
    var mixdownAvailable = !!(window.GLRecordings && window.GLRecordings.resolvePlaybackSource);
    // Phase 3D: surface the recording_id gap — a session with audio but no
    // canonical recording_id stamped is the most common pre-3C state and the
    // first thing to repair on resolve.
    var hasRecordingId = !!(session && session.recording_id);
    var recordingIdGap = hasPersistent && !hasRecordingId;
    return {
      url: url || '(none)',
      isBlob: isBlob,
      hasPersistent: hasPersistent,
      origin: origin,
      hasRecordingId: hasRecordingId,
      recordingIdGap: recordingIdGap,
      mixdownLookupAvailable: mixdownAvailable,
      mixdownLookupNote: mixdownAvailable
        ? 'Mixdown lookup is wired via GLRecordings.resolvePlaybackSource (Phase 3C).'
        : 'Mixdown lookup (rehearsal_mixdowns/*) is not yet wired.'
    };
  }

  // ── Wire to window ────────────────────────────────────────────────────────
  window.GLObs = {
    isEnabled: isEnabled,
    enable: enable,
    disable: disable,
    log: log,
    group: groupLog,
    analyzeTakeContinuity: analyzeTakeContinuity,
    summarizeAudioSource: summarizeAudioSource
  };

  // Console-friendly aliases
  window.glCalibrationOn = enable;
  window.glCalibrationOff = disable;

  if (_enabled) {
    console.log('[GLObs] analyzer calibration mode ENABLED — diagnostics surfaces are active. Toggle off: GLObs.disable()');
  }
})();
