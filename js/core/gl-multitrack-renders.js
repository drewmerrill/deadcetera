// ============================================================================
// js/core/gl-multitrack-renders.js
// Multitrack render job persistence. Drives the worker /multitrack/render/*
// routes which proxy to Modal (ffmpeg mix→alimiter on a 4-CPU container).
// Persists per-render-job state to localStorage so modal close, page reload,
// or cross-page navigation don't strand an in-flight render.
//
// Canonical pattern mirrors GLStems (Stab #14 — gl-stems.js): per-device
// localStorage map, boot-resume hook, getStats() for Runtime Health Overlay.
// New sibling module rather than extending GLStems: different polling cadence
// (5min preview / 15min full vs 8-25min separate), different terminal
// artifact shape (single mix URL vs per-stem URL map), different consumers.
//
// EXPOSES: window.GLMultitrackRenders
// DEPENDS ON: WORKER_URL (worker-api.js)
// EMITS: 'glRenderJobUpdated' CustomEvent on document — every status change
//        carries detail { jobId, status, sessionId, isPreview, publicUrl? }
// ============================================================================

'use strict';

window.GLMultitrackRenders = (function () {

  function _workerBase() {
    return (typeof WORKER_URL !== 'undefined' && WORKER_URL)
      ? WORKER_URL
      : 'https://deadcetera-proxy.drewmerrill.workers.dev';
  }

  // ── Phase A.5 — Job persistence + resume + cancellation ───────────────────
  //
  // Custom Mix renders run 30s-15min on Modal. Previously, `_customMixInFlight`
  // lived on the closure-scoped `_mtState.player` and died on every
  // `_mtClosePlayer` call — the Modal job continued burning CPU while the
  // browser had no way to reattach or surface progress. The closure death
  // also meant page reload mid-render stranded the job entirely.
  //
  // Strategy: persist active jobs to localStorage under `gl_render_jobs_active`
  // keyed by jobId. Entry is small (~500 bytes including the recipe — bounded
  // because the recipe stops at the slider values + per-group sends; per-track
  // recipe is reconstructed from the live tracks list at consume time).
  // On app boot, `_resumeActiveJobsOnBoot()` walks the map and re-polls
  // anything still in 'processing' state, dropping entries past the per-kind
  // max poll window.

  var _ACTIVE_KEY = 'gl_render_jobs_active';
  var _ACTIVE_MAX = 8;  // runaway protection — matches GLStems

  function _now() { return Date.now(); }
  function _isoNow() { return new Date().toISOString(); }

  // Map of jobId → in-memory live poller promises. Prevents double-polling
  // the same job when a resume call races with the original start() loop.
  var _liveJobs = {};

  function _loadActiveJobs() {
    try {
      var raw = localStorage.getItem(_ACTIVE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        try { localStorage.removeItem(_ACTIVE_KEY); } catch (_re) {}
        return {};
      }
      return parsed;
    } catch (e) {
      try { localStorage.removeItem(_ACTIVE_KEY); } catch (_re) {}
      console.warn('[GLRenders] active jobs cache corrupt — cleared');
      return {};
    }
  }

  function _saveActiveJobs(map) {
    try { localStorage.setItem(_ACTIVE_KEY, JSON.stringify(map)); }
    catch (e) { /* quota / private mode — non-fatal; jobs just won't resume */ }
  }

  function _putActiveJob(job) {
    var map = _loadActiveJobs();
    map[job.jobId] = job;
    var keys = Object.keys(map);
    if (keys.length > _ACTIVE_MAX) {
      // Trim oldest completed/failed first; only evict processing if absolutely necessary.
      keys.sort(function(a, b) {
        var pa = (map[a].status === 'processing') ? 1 : 0;
        var pb = (map[b].status === 'processing') ? 1 : 0;
        if (pa !== pb) return pa - pb;
        return (map[a].startedAt || 0) - (map[b].startedAt || 0);
      });
      while (keys.length > _ACTIVE_MAX) {
        var k = keys.shift();
        delete map[k];
      }
    }
    _saveActiveJobs(map);
  }

  function _updateActiveJob(jobId, patch) {
    var map = _loadActiveJobs();
    if (!map[jobId]) return;
    Object.keys(patch).forEach(function(k) { map[jobId][k] = patch[k]; });
    map[jobId].updatedAt = _now();
    _saveActiveJobs(map);
  }

  function _removeActiveJob(jobId) {
    var map = _loadActiveJobs();
    if (!map[jobId]) return;
    delete map[jobId];
    _saveActiveJobs(map);
    delete _liveJobs[jobId];
  }

  // Preview budget is shorter — server caps at 60s slice + ~30-60s render = ~2min realistic.
  // Full render: 3-hour rehearsal at 17 stems ≈ 4-6min realistic; 15min budget gives headroom.
  function _maxPollMs(isPreview) {
    return isPreview ? 5 * 60 * 1000 : 15 * 60 * 1000;
  }

  function _makeJobId(callId) {
    return 'render:' + (callId || ('j-' + _now()));
  }

  function _emitJobEvent(job) {
    try {
      document.dispatchEvent(new CustomEvent('glRenderJobUpdated', {
        detail: {
          jobId: job.jobId,
          status: job.status,
          sessionId: job.sessionId,
          isPreview: job.isPreview,
          publicUrl: job.publicUrl || null,
          serverPhase: job.serverPhase || null,
        }
      }));
    } catch (e) {}
  }

  // ── Public API ───────────────────────────────────────────────────────────

  // Stats for the Runtime Health Overlay. NO worker URLs, NO recipes, NO
  // publicUrls leaked — just counts + timing.
  function getStats() {
    var map = _loadActiveJobs();
    var jobs = Object.keys(map).map(function(k) { return map[k]; });
    var byStatus = { processing: 0, completed: 0, cancelled: 0, failed: 0 };
    jobs.forEach(function(j) {
      if (byStatus[j.status] != null) byStatus[j.status]++;
    });
    var lastPoll = 0;
    jobs.forEach(function(j) { if (j.lastPollAt && j.lastPollAt > lastPoll) lastPoll = j.lastPollAt; });
    return {
      activeCount: jobs.length,
      processing: byStatus.processing,
      completed: byStatus.completed,
      cancelled: byStatus.cancelled,
      failed: byStatus.failed,
      lastPollAt: lastPoll || null,
      liveLoops: Object.keys(_liveJobs).length,
    };
  }

  function getActiveJobs() {
    var map = _loadActiveJobs();
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function getJobsForSession(sessionId) {
    if (!sessionId) return [];
    return getActiveJobs().filter(function(j) { return j.sessionId === sessionId; });
  }

  // Convenience for Custom Mix modal reopen + Review Mode banner: find the
  // most-recent processing job for this session, if any. Returns null if none.
  function findInFlightForSession(sessionId, opts) {
    opts = opts || {};
    var jobs = getJobsForSession(sessionId).filter(function(j) {
      if (j.status !== 'processing') return false;
      if (typeof opts.isPreview === 'boolean' && j.isPreview !== opts.isPreview) return false;
      return true;
    });
    if (!jobs.length) return null;
    jobs.sort(function(a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
    return jobs[0];
  }

  // Best-effort cancel. Always clears local state + stops polling. Modal job
  // continues to completion server-side (no /multitrack/render/cancel endpoint
  // today) but the browser detaches cleanly.
  function cancelJob(jobId) {
    var map = _loadActiveJobs();
    var job = map[jobId];
    if (!job) return { ok: true, alreadyGone: true };
    if (job.status === 'cancelled' || job.status === 'completed') {
      return { ok: true, alreadyGone: true };
    }
    _updateActiveJob(jobId, { status: 'cancelled', cancelledAt: _now() });
    job.status = 'cancelled';
    _emitJobEvent(job);
    console.log('[GLRenders] cancel requested for', jobId);
    // Detach the local poll on the next tick; the loop sees `cancelled` in
    // the persisted map and bails before its next fetch.
    setTimeout(function() { _removeActiveJob(jobId); }, 500);
    return { ok: true };
  }

  // ── Internal poll loop — shared by start() and _resumeJob() ─────────────

  async function _pollRenderJob(jobId, callId, progressId, isPreview, startedAt, onProgress) {
    var pollStart = startedAt || _now();
    var budget = _maxPollMs(isPreview);
    onProgress = typeof onProgress === 'function' ? onProgress : function(){};
    while (true) {
      if (_now() - pollStart > budget) {
        _updateActiveJob(jobId, { status: 'failed', failReason: 'client_timeout' });
        var snapT = _loadActiveJobs()[jobId];
        if (snapT) _emitJobEvent(snapT);
        _removeActiveJob(jobId);
        throw new Error('render timed out (>' + Math.round(budget/60000) + 'min on client)');
      }
      // Cancellation check before each network call — cheap exit.
      var snap = _loadActiveJobs()[jobId];
      if (!snap || snap.status === 'cancelled') {
        throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
      }
      await new Promise(function(r) { setTimeout(r, 5000); });
      // Re-check after sleep — user may have cancelled while we waited.
      snap = _loadActiveJobs()[jobId];
      if (!snap || snap.status === 'cancelled') {
        throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
      }
      var checkRes;
      try {
        checkRes = await fetch(_workerBase() + '/multitrack/render/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: callId, progressId: progressId })
        });
      } catch (netErr) {
        console.warn('[GLRenders] poll network blip for', jobId, netErr && netErr.message);
        _updateActiveJob(jobId, { lastPollAt: _now(), lastPollError: 'network' });
        continue;
      }
      var checkData = null;
      try { checkData = await checkRes.json(); } catch (_pe) {}
      _updateActiveJob(jobId, { lastPollAt: _now() });
      if (!checkData) {
        // Bug #19 root cause: Modal can return 502 with non-JSON body
        // ("modal-http: function call timed out") that the frontend used
        // to swallow as SyntaxError. We treat ANY non-JSON response as
        // a transient blip and keep polling within budget — the persisted
        // record means the user sees real status next tick.
        _updateActiveJob(jobId, { lastPollError: 'non_json_' + checkRes.status });
        continue;
      }
      if (checkData.status === 'done' && checkData.publicUrl) {
        var record = {
          publicUrl: checkData.publicUrl,
          fileName: checkData.fileName || null,
          format: checkData.format || null,
          renderId: checkData.renderId || null,
        };
        _updateActiveJob(jobId, {
          status: 'completed',
          completedAt: _now(),
          publicUrl: record.publicUrl,
          fileName: record.fileName,
          format: record.format,
        });
        var jobSnap = _loadActiveJobs()[jobId];
        if (jobSnap) _emitJobEvent(jobSnap);
        onProgress('done', null);
        return record;
      }
      if (checkData.success === false || checkData.status === 'error') {
        var reason = checkData.error || checkData.detail || 'render_error';
        _updateActiveJob(jobId, { status: 'failed', failReason: reason });
        var jobSnapF = _loadActiveJobs()[jobId];
        if (jobSnapF) _emitJobEvent(jobSnapF);
        _removeActiveJob(jobId);
        throw new Error(reason);
      }
      // Still processing — surface the progress.
      if (checkData.progress) {
        _updateActiveJob(jobId, { serverPhase: checkData.progress });
        onProgress('processing', checkData.progress);
      }
      // Emit a heartbeat each tick so banner subscribers can refresh their
      // elapsed-label even between phase transitions. Cost is one CustomEvent
      // per 5s of in-flight render — negligible.
      var beat = _loadActiveJobs()[jobId];
      if (beat) _emitJobEvent(beat);
    }
  }

  // Kick off a new render. Persists job state BEFORE returning so a fast
  // modal close doesn't lose the callId.
  async function start(opts) {
    if (!opts || !opts.bandSlug || !opts.sessionId || !opts.renderId || !opts.recipe) {
      throw new Error('start: bandSlug, sessionId, renderId, recipe required');
    }
    var isPreview = !!opts.isPreview;
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function(){};
    var progressId = opts.progressId || ('rg-' + _now() + '-' + Math.random().toString(36).slice(2, 8));
    var startedAt = _now();

    onProgress('starting', null);
    var startRes = await fetch(_workerBase() + '/multitrack/render/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bandSlug: opts.bandSlug,
        sessionId: opts.sessionId,
        renderId: opts.renderId,
        recipe: opts.recipe,
        progressId: progressId,
      })
    });
    var startJson = null;
    try { startJson = await startRes.json(); } catch (_pe) {}
    if (!startRes.ok || !startJson || !startJson.call_id) {
      var msg = (startJson && (startJson.error || startJson.detail)) || ('HTTP ' + startRes.status);
      throw new Error(msg);
    }
    var callId = startJson.call_id;
    var jobId = _makeJobId(callId);

    // Persist the recipe so modal reopen can restore sliders. We store the
    // group-level recipe (sliders + sends + masterReverbWet) plus the
    // bandSlug/sessionId/renderId — small enough to fit comfortably in
    // localStorage even at the 8-job cap.
    _putActiveJob({
      jobId: jobId,
      callId: callId,
      progressId: progressId,
      bandSlug: opts.bandSlug,
      sessionId: opts.sessionId,
      renderId: opts.renderId,
      isPreview: isPreview,
      recipe: opts.recipe,
      // Optional UI-level recipe summary for fast restore without recompute.
      recipeUI: opts.recipeUI || null,
      status: 'processing',
      serverPhase: null,
      startedAt: startedAt,
      updatedAt: startedAt,
    });
    var initial = _loadActiveJobs()[jobId];
    if (initial) _emitJobEvent(initial);
    console.log('[GLRenders] job started:', jobId, 'preview=' + isPreview);

    onProgress('processing', null);
    var promise = _pollRenderJob(jobId, callId, progressId, isPreview, startedAt, onProgress);
    _liveJobs[jobId] = promise;
    promise.then(function() { delete _liveJobs[jobId]; },
                 function() { delete _liveJobs[jobId]; });

    var record;
    try {
      record = await promise;
    } catch (e) {
      if (e && e.code === 'CANCELLED') {
        console.log('[GLRenders] job cancelled mid-poll:', jobId);
      }
      throw e;
    }
    var elapsed = (_now() - startedAt) / 1000;
    console.log('[GLRenders] job completed:', jobId, 'elapsed=' + Math.round(elapsed) + 's');
    // Leave the completed record in localStorage briefly so any consumer
    // that's about to render the result has a chance to read recipeUI / publicUrl.
    // Auto-prune after 60s so completed jobs don't accumulate forever.
    setTimeout(function() { _removeActiveJob(jobId); }, 60000);
    return Object.assign({}, record, { jobId: jobId, elapsedSec: elapsed });
  }

  // Resume a 'processing' job after tab close / refresh. Re-polls /check;
  // idempotent — if a live poller already exists, returns its promise.
  function _resumeJob(job) {
    if (!job || !job.jobId || !job.callId) return null;
    if (_liveJobs[job.jobId]) return _liveJobs[job.jobId];
    var promise = (async function() {
      console.log('[GLRenders] resuming job:', job.jobId);
      try {
        var record = await _pollRenderJob(
          job.jobId, job.callId, job.progressId,
          !!job.isPreview, job.startedAt || _now(),
          function() {}
        );
        var elapsed = (_now() - (job.startedAt || _now())) / 1000;
        console.log('[GLRenders] resumed job completed:', job.jobId, 'elapsed=' + Math.round(elapsed) + 's');
        // Same auto-prune semantics as start().
        setTimeout(function() { _removeActiveJob(job.jobId); }, 60000);
        return Object.assign({}, record, { jobId: job.jobId, elapsedSec: elapsed, resumed: true });
      } catch (e) {
        if (e && e.code === 'CANCELLED') return null;
        throw e;
      }
    })();
    _liveJobs[job.jobId] = promise;
    promise.then(function() { delete _liveJobs[job.jobId]; },
                 function() { delete _liveJobs[job.jobId]; });
    return promise;
  }

  // ── Boot-time resume hook ────────────────────────────────────────────────

  var _bootRanOnce = false;
  function _resumeActiveJobsOnBoot() {
    if (_bootRanOnce) return;
    _bootRanOnce = true;
    var map = _loadActiveJobs();
    var ids = Object.keys(map);
    if (!ids.length) return;
    var pruned = 0;
    ids.forEach(function(id) {
      var j = map[id];
      if (!j || j.status !== 'processing') {
        delete map[id]; pruned++;
        return;
      }
      var budget = _maxPollMs(!!j.isPreview);
      // 60s grace period so a job that finished just past the cap still
      // gets one more /check before being abandoned.
      if (_now() - (j.startedAt || 0) > budget + 60000) {
        delete map[id]; pruned++;
        return;
      }
    });
    if (pruned > 0) _saveActiveJobs(map);
    var live = Object.keys(map);
    if (!live.length) return;
    console.log('[GLRenders] boot resume — found ' + live.length + ' active render(s)');
    live.forEach(function(id) {
      var j = map[id];
      _resumeJob(j).catch(function(e) {
        console.warn('[GLRenders] resume failed for', id, e && e.message);
      });
    });
  }

  // Fire boot resume once per page load. Defer via setTimeout(0) so the IIFE
  // can finish exposing the public surface before the resume loop reads it.
  if (typeof window !== 'undefined' && !window._glRendersBootScheduled) {
    window._glRendersBootScheduled = true;
    setTimeout(_resumeActiveJobsOnBoot, 0);
  }

  // ── Public surface ───────────────────────────────────────────────────────
  return {
    // Core lifecycle
    start: start,
    cancelJob: cancelJob,
    // Read API
    getStats: getStats,
    getActiveJobs: getActiveJobs,
    getJobsForSession: getJobsForSession,
    findInFlightForSession: findInFlightForSession,
    // For debugging / advanced consumers
    _resumeActiveJobsOnBoot: _resumeActiveJobsOnBoot,
  };
})();
