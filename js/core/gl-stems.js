// ============================================================================
// js/core/gl-stems.js
// Stem separation client API. Drives the worker /stems/separate route, which
// proxies to Modal (HT-Demucs on a T4 GPU). Persists per-song stem URLs to
// Firebase under bands/{slug}/songs/{title}/stems via the existing
// loadBandDataFromDrive / saveBandDataToDrive helpers.
//
// EXPOSES: window.GLStems
// DEPENDS ON: WORKER_URL (worker-api.js), loadBandDataFromDrive, saveBandDataToDrive
// ============================================================================

'use strict';

window.GLStems = (function () {

  function _workerBase() {
    return (typeof WORKER_URL !== 'undefined' && WORKER_URL)
      ? WORKER_URL
      : 'https://deadcetera-proxy.drewmerrill.workers.dev';
  }

  // ── Stab #14 — Job persistence + resume + cancellation ────────────────────
  //
  // GPU stem jobs run 90s–25min on Modal. If the user closes the tab, refreshes,
  // or navigates away, the old code just stopped polling — the GPU job continued
  // burning Modal quota with no way to retrieve the result and no UI signal.
  //
  // Strategy: persist active jobs to localStorage under `gl_stem_jobs_active`
  // keyed by jobId. The entry is small (~300 bytes) and survives reload. On app
  // boot, `_resumeActiveJobs()` walks the map and re-polls anything still in
  // 'processing' state, dropping entries older than the per-kind max poll
  // window (Demucs: 8 min; LALAL: 25 min; Spatial: 10 min).
  //
  // localStorage was chosen over Firebase to keep this orthogonal to band-data
  // schema and avoid adding new ownership conflicts. It's per-device; if the
  // user starts on iPhone and finishes on desktop the result still lands in
  // Firebase via the existing `saveBandDataToDrive` call.
  var _ACTIVE_KEY = 'gl_stem_jobs_active';
  var _ACTIVE_MAX = 8;  // cap so a runaway loop can't blow out localStorage

  function _now() { return Date.now(); }
  function _isoNow() { return new Date().toISOString(); }

  // Map of jobId → in-memory live poller promises. Keeps us from double-polling
  // the same job after a resume call races with the original separate() loop.
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
      console.warn('[GLStems] active jobs cache corrupt — cleared');
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
    // Trim oldest if we exceed cap — defensive; should never happen in normal use.
    var keys = Object.keys(map);
    if (keys.length > _ACTIVE_MAX) {
      keys.sort(function(a, b) { return (map[a].startedAt || 0) - (map[b].startedAt || 0); });
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

  function _maxPollMsForKind(kind) {
    if (kind === 'lalal') return 25 * 60 * 1000;
    if (kind === 'spatial') return 10 * 60 * 1000;
    return 8 * 60 * 1000; // demucs separate (default)
  }

  // Build a stable jobId so logs + persistence agree. callId from Modal is the
  // unique identifier; we prefix with kind so different APIs don't collide.
  function _makeJobId(kind, callId) {
    return (kind || 'stem') + ':' + (callId || ('j-' + _now()));
  }

  // Public-ish: stats for the Runtime Health Overlay. NO worker URLs, NO tokens,
  // NO stem URLs leaked — just counts + kinds + timing.
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
      kinds: jobs.map(function(j) { return j.kind; }),
      liveLoops: Object.keys(_liveJobs).length,
    };
  }

  // Best-effort cancel. Always clears local state + stops polling. The worker
  // call is fire-and-forget from the caller's perspective — UI moves on
  // immediately. Idempotent: calling twice is a no-op the second time.
  async function cancelJob(jobId) {
    var map = _loadActiveJobs();
    var job = map[jobId];
    if (!job) return { ok: true, alreadyGone: true };
    if (job.status === 'cancelled' || job.status === 'completed') {
      return { ok: true, alreadyGone: true };
    }
    _updateActiveJob(jobId, { status: 'cancelled', cancelledAt: _now() });
    console.log('[GLStems] cancel requested for', jobId);
    var callId = job.callId;
    var endpoint = job.kind === 'lalal' ? null : '/stems/cancel';
    // LALAL doesn't have a worker cancel endpoint yet — client-only cancel
    // is honest (the user sees the spinner stop) but the GPU job runs out.
    if (callId && endpoint) {
      try {
        var res = await fetch(_workerBase() + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: callId }),
        });
        var data = null;
        try { data = await res.json(); } catch (_pe) {}
        console.log('[GLStems] cancel response for', jobId, data && data.cancelled);
      } catch (e) {
        console.warn('[GLStems] cancel network error for', jobId, e && e.message);
      }
    }
    // Remove from active map a beat after the cancel — gives any in-flight
    // poll loop a chance to see the cancelled status and bail cleanly.
    setTimeout(function() { _removeActiveJob(jobId); }, 500);
    return { ok: true };
  }

  // Public: walk active jobs and resume polling for any still-processing
  // entries. Called once on app boot from _resumeActiveJobsOnBoot below.
  function getActiveJobs() {
    var map = _loadActiveJobs();
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  // Slugged song id used as the R2 prefix so the stems folder is human
  // readable. Append a timestamp so re-runs don't overwrite each other.
  function _stemsKey(title) {
    var slug = (title || 'song').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return (slug || 'song') + '-' + Date.now();
  }

  // Returns { stems:{drums,bass,other,vocals}, sample_rate, model, separatedAt, sourceLabel, elapsedSec } or null
  async function getStems(title) {
    if (!title || typeof loadBandDataFromDrive !== 'function') return null;
    try {
      var d = await loadBandDataFromDrive(title, 'stems');
      if (d && d.stems && d.stems.drums) return d;
      return null;
    } catch (e) { return null; }
  }

  async function hasStems(title) { return !!(await getStems(title)); }

  // opts: { sourceUrl?, driveFileId?, accessToken?, audioDataUrl?,
  //         firebaseAudioRef?, sourceLabel?, model?, onProgress? }
  // model: 'htdemucs' (4 stems), 'htdemucs_6s' (6 stems, default),
  //        'htdemucs_ft' (4 stems HQ, ~3-4× slower),
  //        'mdx_extra' (4 stems MDX architecture, ~1.5× slower)
  // firebaseAudioRef: optional `firebase-audio://...` pointer saved alongside
  //   the audioDataUrl so a future re-separate can re-fetch the base64
  //   without forcing the user to re-pick the take.
  // onProgress(stage, percent) — stage is 'starting' | 'processing' | 'finalizing'.
  //
  // Async flow: POST /stems/start spawns the Modal GPU job and returns
  // call_id (~1-3s). Then poll POST /stems/check every 5s until status='done'.
  // Avoids Modal's ~150s web-endpoint cap that the legacy synchronous
  // /stems/separate flow hit on the heavier models (htdemucs_ft, mdx_extra).
  var ALLOWED_MODELS = ['htdemucs', 'htdemucs_6s', 'htdemucs_ft', 'mdx_extra'];

  // Stab #14 — extracted poll loop so both `separate()` and `_resumeJob()`
  // share the same polling/finalize/persistence code path. The loop reads
  // the active-job map between ticks so a cancel() from any context bails
  // immediately (no second `await fetch` after the abort decision).
  async function _pollSeparateJob(jobId, callId, opts, onProgress, startedAt) {
    var pollStart = startedAt || _now();
    var maxPollMs = _maxPollMsForKind('separate');
    var lastPercent = 0;
    while (true) {
      if (_now() - pollStart > maxPollMs) {
        _updateActiveJob(jobId, { status: 'failed', failReason: 'client_timeout' });
        _removeActiveJob(jobId);
        throw new Error('Stems separation timed out (>8min on client)');
      }
      // Cancellation check — if another caller marked the job cancelled
      // (e.g., user clicked Cancel, or _mtAbort sweep fired), bail cleanly.
      var snap = _loadActiveJobs()[jobId];
      if (!snap || snap.status === 'cancelled') {
        throw Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
      }
      await new Promise(function(r) { setTimeout(r, 5000); });
      var checkRes;
      try {
        checkRes = await fetch(_workerBase() + '/stems/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: callId })
        });
      } catch (netErr) {
        // Transient network blip — keep trying until the maxPollMs cap. No
        // need to mark the job failed; come back next tick.
        console.warn('[GLStems] poll network blip for', jobId, netErr && netErr.message);
        _updateActiveJob(jobId, { lastPollAt: _now(), lastPollError: 'network' });
        continue;
      }
      var checkData = null;
      try { checkData = await checkRes.json(); } catch (e) {}
      _updateActiveJob(jobId, { lastPollAt: _now() });
      if (!checkData) {
        _updateActiveJob(jobId, { status: 'failed', failReason: 'bad_response' });
        _removeActiveJob(jobId);
        throw new Error('Bad check response (' + checkRes.status + ')');
      }
      if (!checkData.success) {
        _updateActiveJob(jobId, { status: 'failed', failReason: checkData.error || 'check_failed' });
        _removeActiveJob(jobId);
        throw new Error(checkData.error || 'stems_check_failed');
      }
      if (checkData.status === 'processing') {
        var typicalSec = (snap.model === 'htdemucs_ft' || snap.model === 'mdx_extra') ? 180 : 90;
        var pct = Math.min(95, Math.round(((_now() - pollStart) / 1000) / typicalSec * 100));
        if (pct !== lastPercent) {
          lastPercent = pct;
          onProgress('processing', pct);
        }
        continue;
      }
      if (checkData.status === 'done') {
        onProgress('finalizing', 100);
        return checkData;
      }
      console.warn('[GLStems] Unknown stems check status:', checkData.status);
    }
  }

  async function separate(title, opts) {
    if (!title) throw new Error('title required');
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function(){};
    var startedAt = _now();

    // Stage 1: kick off the Modal GPU job
    onProgress('starting', 0);
    var body = { songId: _stemsKey(title) };
    if (ALLOWED_MODELS.indexOf(opts.model) !== -1) {
      body.model = opts.model;
    }
    if (opts.sourceUrl) {
      body.sourceUrl = opts.sourceUrl;
    } else if (opts.driveFileId) {
      body.driveFileId = opts.driveFileId;
      if (opts.accessToken) body.accessToken = opts.accessToken;
    } else if (opts.audioDataUrl) {
      // For firebase-audio:// Best Shots — base64 stored in Firebase. The
      // worker stages this to R2 and passes a public URL to Modal.
      body.audioBase64DataUrl = opts.audioDataUrl;
    } else {
      throw new Error('sourceUrl, driveFileId, or audioDataUrl required');
    }

    var startRes = await fetch(_workerBase() + '/stems/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var startData = null;
    try { startData = await startRes.json(); } catch (e) {}
    if (!startData) throw new Error('Bad start response (' + startRes.status + ')');
    if (!startData.success) throw new Error(startData.error || 'stems_start_failed');
    var callId = startData.call_id;
    if (!callId) throw new Error('No call_id from /stems/start');

    // Stab #14 — persist the job so a tab close / refresh can resume it.
    // We persist only enough to re-bind the result: kind, title, callId,
    // model, source pointers (no credentials, no base64 bytes). The
    // `audioBase64DataUrl` is intentionally NOT persisted — it can be 30+ MB
    // and would blow out localStorage. If the user closes the tab during
    // a base64-source job, resume will still poll for the result; the
    // source-ref restore on completion just won't include audioDataUrl.
    var jobId = _makeJobId('separate', callId);
    _putActiveJob({
      jobId: jobId,
      kind: 'separate',
      callId: callId,
      title: title,
      status: 'processing',
      model: startData.model || body.model || 'htdemucs_6s',
      sourceUrl: opts.sourceUrl || null,
      driveFileId: opts.driveFileId || null,
      firebaseAudioRef: opts.firebaseAudioRef || null,
      sourceLabel: opts.sourceLabel || (opts.sourceUrl ? 'URL' : 'Drive'),
      startedAt: startedAt,
      updatedAt: startedAt,
    });
    console.log('[GLStems] job started:', jobId, 'model=' + (startData.model || body.model));

    onProgress('processing', 0);
    var data;
    try {
      data = await _pollSeparateJob(jobId, callId, opts, onProgress, startedAt);
    } catch (e) {
      // CANCELLED — surface a structured error so callers can render the
      // calm-cancellation UI instead of an alarming failure toast.
      if (e && e.code === 'CANCELLED') {
        console.log('[GLStems] job cancelled mid-poll:', jobId);
        throw e;
      }
      throw e;
    }

    var record = {
      stems: data.stems,
      sample_rate: data.sample_rate,
      model: data.model,
      separatedAt: _isoNow(),
      sourceLabel: opts.sourceLabel || (opts.sourceUrl ? 'URL' : 'Drive'),
      elapsedSec: (_now() - startedAt) / 1000
    };
    // Save source ref so re-separate can default-fill the source. We save
    // pointers (driveFileId, firebaseAudioRef), not credentials (accessToken
    // is per-session) and not bytes (audioDataUrl can be 30+ MB).
    if (opts.sourceUrl) record.sourceUrl = opts.sourceUrl;
    if (opts.driveFileId) record.driveFileId = opts.driveFileId;
    if (opts.firebaseAudioRef) record.firebaseAudioRef = opts.firebaseAudioRef;
    if (typeof saveBandDataToDrive === 'function') {
      try { await saveBandDataToDrive(title, 'stems', record); } catch (e) {}
    }
    _updateActiveJob(jobId, { status: 'completed', completedAt: _now() });
    _removeActiveJob(jobId);
    console.log('[GLStems] job completed:', jobId, 'elapsed=' + Math.round(record.elapsedSec) + 's');
    return record;
  }

  // Stab #14 — resume an in-progress 'separate' job after tab close / refresh.
  // Re-polls /stems/check; if the result is already 'done' on the server side,
  // returns the record immediately. If still processing, polls until done or
  // until the original maxPollMs window (computed from startedAt) elapses.
  // Idempotent — if a live poller already exists for this job, returns its
  // promise instead of starting a second one.
  async function _resumeJob(job, onProgress) {
    if (!job || !job.jobId || !job.callId || !job.title) return null;
    if (_liveJobs[job.jobId]) return _liveJobs[job.jobId];
    onProgress = typeof onProgress === 'function' ? onProgress : function(){};

    var promise = (async function() {
      console.log('[GLStems] resuming job:', job.jobId, 'kind=' + job.kind);
      onProgress('resuming', 0);
      var data;
      try {
        data = await _pollSeparateJob(job.jobId, job.callId, {}, onProgress, job.startedAt || _now());
      } catch (e) {
        if (e && e.code === 'CANCELLED') return null;
        throw e;
      }
      var record = {
        stems: data.stems,
        sample_rate: data.sample_rate,
        model: data.model,
        separatedAt: _isoNow(),
        sourceLabel: job.sourceLabel || 'Resumed',
        elapsedSec: (_now() - (job.startedAt || _now())) / 1000,
        resumed: true
      };
      if (job.sourceUrl) record.sourceUrl = job.sourceUrl;
      if (job.driveFileId) record.driveFileId = job.driveFileId;
      if (job.firebaseAudioRef) record.firebaseAudioRef = job.firebaseAudioRef;
      if (typeof saveBandDataToDrive === 'function') {
        try { await saveBandDataToDrive(job.title, 'stems', record); } catch (e) {}
      }
      _updateActiveJob(job.jobId, { status: 'completed', completedAt: _now() });
      _removeActiveJob(job.jobId);
      console.log('[GLStems] resumed job completed:', job.jobId);
      return record;
    })();

    _liveJobs[job.jobId] = promise;
    // Drop ref when promise settles, so a future resume on the same job (very
    // unlikely — completed jobs are removed from map) can start fresh.
    promise.then(function() { delete _liveJobs[job.jobId]; },
                 function() { delete _liveJobs[job.jobId]; });
    return promise;
  }

  // Boot-time hook — walks active jobs, prunes stale entries (older than the
  // per-kind max poll window), and resumes any still-fresh 'processing' job.
  // Only fires once per page load (idempotent via _bootRanOnce).
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
      var window = _maxPollMsForKind(j.kind);
      // Add a small grace period — the user may have left mid-poll just past
      // the cap and we want one more check rather than abandoning the result.
      if (_now() - (j.startedAt || 0) > window + 60000) {
        delete map[id]; pruned++;
        return;
      }
    });
    if (pruned > 0) _saveActiveJobs(map);
    var live = Object.keys(map);
    if (!live.length) return;
    console.log('[GLStems] boot resume — found ' + live.length + ' active job(s)');
    // Resume in background — each separate() consumer can re-find their job
    // via getActiveJobs() and attach progress callbacks; until they do, the
    // poll loop just runs to completion and saves the record to Firebase.
    live.forEach(function(id) {
      var j = map[id];
      if (j.kind === 'separate') {
        _resumeJob(j).catch(function(e) {
          console.warn('[GLStems] resume failed for', id, e && e.message);
        });
      }
      // LALAL + spatial resume not implemented in M.4 — out of scope for the
      // primary HIGH RISK item. Their jobs are still persisted; on a fresh
      // page-load they'll be visible in getActiveJobs() and Drew can decide
      // whether to abandon or extend resume support in a follow-up.
    });
  }

  // Fire resume on load — once per page. Defer via setTimeout(0) so the IIFE
  // can finish exposing the public surface before the resume loop reads it.
  if (typeof window !== 'undefined' && !window._glStemsBootScheduled) {
    window._glStemsBootScheduled = true;
    setTimeout(_resumeActiveJobsOnBoot, 0);
  }

  // Stab #14 — beforeunload hook. We don't try to call /stems/cancel on
  // unload (the navigator.sendBeacon path could be flaky and we'd risk
  // killing a job the user actually wants to keep). Instead we just leave
  // the persisted state in place; the next page load resumes it. The poll
  // loop's `cancelled` check + the `_resumeActiveJobsOnBoot` re-attach is
  // already idempotent so no race risk.
  //
  // For the truly-abandoned case (user closes tab and never returns) the
  // Modal job runs to completion — wasted but bounded. A future hardening
  // pass could add a `keepalive: true` fetch to /stems/cancel here, but
  // tab-close speed makes it unreliable. Survivability > forced cancel.

  async function clearStems(title) {
    if (typeof saveBandDataToDrive !== 'function') return;
    try { await saveBandDataToDrive(title, 'stems', null); } catch (e) {}
  }

  // ── LALAL.AI lead/backing split (Phase 1 — Harmony Painkiller) ─────────
  // Stored separately from `stems` (per-instrument Demucs) under the
  // `lalal_split` band-data field. Same record shape as stems above so
  // existing UI patterns can read either.
  //
  // Returns { stems:{lead,backing,instrumental,mix_no_lead}, lalal_task_id, separatedAt, sourceLabel, durationSec, elapsedSec } or null.
  async function getLeadBackingSplit(title) {
    if (!title || typeof loadBandDataFromDrive !== 'function') return null;
    try {
      var d = await loadBandDataFromDrive(title, 'lalal_split');
      if (d && d.stems && d.stems.lead) return d;
      return null;
    } catch (e) { return null; }
  }

  async function hasLeadBackingSplit(title) { return !!(await getLeadBackingSplit(title)); }

  // opts: { sourceUrl?, driveFileId?, accessToken?, audioDataUrl?, sourceLabel?,
  //         onProgress? }
  // onProgress(stage, percent) — stage is 'starting' | 'processing' | 'finalizing'.
  //
  // Async flow: POST /lalal/start (upload + submit, ~10-30s) → returns task_id.
  // Then poll POST /lalal/check every 5s until status='done'. Avoids
  // Cloudflare's 100s subrequest TTFB and Modal's 150s web cap that the
  // legacy synchronous /lalal/split flow hit.
  async function splitLeadBacking(title, opts) {
    if (!title) throw new Error('title required');
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function() {};
    var startedAt = Date.now();
    var songId = _stemsKey(title);

    // Stage 1: kick off LALAL job
    onProgress('starting', 0);
    var startBody = { songId: songId };
    if (opts.sourceUrl) startBody.sourceUrl = opts.sourceUrl;
    else if (opts.driveFileId) {
      startBody.driveFileId = opts.driveFileId;
      if (opts.accessToken) startBody.accessToken = opts.accessToken;
    } else if (opts.audioDataUrl) startBody.audioBase64DataUrl = opts.audioDataUrl;
    else throw new Error('sourceUrl, driveFileId, or audioDataUrl required');

    var startRes = await fetch(_workerBase() + '/lalal/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody)
    });
    var startData = null;
    try { startData = await startRes.json(); } catch (e) {}
    if (!startData) throw new Error('Bad start response (' + startRes.status + ')');
    if (!startData.success) throw new Error(startData.error || 'lalal_start_failed');
    var taskId = startData.lalal_task_id;
    if (!taskId) throw new Error('No lalal_task_id from start');

    // Stage 2: poll /lalal/check until done. 5s interval, 25 min cap (matches
    // Modal's internal LALAL deadline).
    onProgress('processing', 0);
    var pollStart = Date.now();
    var maxPollMs = 25 * 60 * 1000;
    var record = null;
    while (true) {
      if (Date.now() - pollStart > maxPollMs) {
        throw new Error('LALAL timed out (>25min on client)');
      }
      await new Promise(function(r) { setTimeout(r, 5000); });
      var checkRes = await fetch(_workerBase() + '/lalal/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: songId, taskId: taskId })
      });
      var checkData = null;
      try { checkData = await checkRes.json(); } catch (e) {}
      if (!checkData) throw new Error('Bad check response (' + checkRes.status + ')');
      if (!checkData.success) throw new Error(checkData.error || 'lalal_check_failed');

      if (checkData.status === 'processing') {
        onProgress('processing', Number(checkData.progress) || 0);
        continue;
      }
      if (checkData.status === 'done') {
        onProgress('finalizing', 100);
        record = {
          stems: checkData.stems,
          lalal_task_id: checkData.lalal_task_id,
          separatedAt: new Date().toISOString(),
          sourceLabel: opts.sourceLabel || (opts.sourceUrl ? 'URL' : 'Drive'),
          durationSec: checkData.duration_sec,
          elapsedSec: (Date.now() - startedAt) / 1000,
          tool: 'lalal_lead_back'
        };
        break;
      }
      // Unknown status — keep polling, but don't lose track of it
      console.warn('[GLStems] Unknown LALAL check status:', checkData.status);
    }

    if (typeof saveBandDataToDrive === 'function') {
      try { await saveBandDataToDrive(title, 'lalal_split', record); } catch (e) {}
    }
    return record;
  }

  async function clearLeadBackingSplit(title) {
    if (typeof saveBandDataToDrive !== 'function') return;
    try { await saveBandDataToDrive(title, 'lalal_split', null); } catch (e) {}
  }

  // ── Phase 2: Spatial separation (pan + tone fingerprint) ──────────────
  // Stage 2 refinement: split any existing stem (typically Demucs "other"
  // or "guitar") by stereo pan position, with optional reference-clip
  // fingerprint biasing.
  //
  // Storage:
  //   - Fingerprint library: band-level, under bands/{slug}/fingerprints —
  //     loaded/saved with songTitle='_band'. Map of { name → fingerprint }.
  //     Fingerprints are small (~160 floats) so the whole library is one
  //     read/write. Drew uploads "Jerry — Wolf '77" once and it's available
  //     to every song's spatial-split.
  //   - Spatial-split results: per-song under `spatial_split` — array of
  //     records (one per separated source stem), each with stems URLs,
  //     pan windows used, references used, sourceStemId, separatedAt.

  async function loadFingerprints() {
    if (typeof loadBandDataFromDrive !== 'function') return {};
    try {
      var d = await loadBandDataFromDrive('_band', 'fingerprints');
      return (d && typeof d === 'object') ? d : {};
    } catch (e) { return {}; }
  }

  async function saveFingerprint(name, fingerprintRec) {
    if (!name) throw new Error('fingerprint name required');
    var lib = await loadFingerprints();
    lib[name] = Object.assign({}, fingerprintRec, {
      name: name,
      createdAt: lib[name] && lib[name].createdAt ? lib[name].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (typeof saveBandDataToDrive === 'function') {
      await saveBandDataToDrive('_band', 'fingerprints', lib);
    }
    return lib;
  }

  async function deleteFingerprint(name) {
    var lib = await loadFingerprints();
    if (!lib[name]) return lib;
    delete lib[name];
    if (typeof saveBandDataToDrive === 'function') {
      await saveBandDataToDrive('_band', 'fingerprints', lib);
    }
    return lib;
  }

  // Compute a tone fingerprint from a clean reference clip URL. Returns
  // { fingerprint:{ mean:[], std:[], n_mels:80 }, sourceUrl, sourceLabel }.
  // Caller persists via saveFingerprint(name, result).
  async function fingerprintTone(sourceUrl, opts) {
    if (!sourceUrl) throw new Error('sourceUrl required');
    opts = opts || {};
    var res = await fetch(_workerBase() + '/stems/fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl: sourceUrl }),
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!data || !data.success) throw new Error((data && data.error) || ('fingerprint_failed (' + res.status + ')'));
    return {
      fingerprint: data.fingerprint,
      sourceUrl: sourceUrl,
      sourceLabel: opts.sourceLabel || 'Reference',
      elapsedSec: data.elapsed_sec,
    };
  }

  // Compute pan-energy histogram for a stem URL → returns suggested windows.
  async function analyzePan(sourceUrl) {
    if (!sourceUrl) throw new Error('sourceUrl required');
    var res = await fetch(_workerBase() + '/stems/pan-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl: sourceUrl }),
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!data || !data.success) throw new Error((data && data.error) || ('pan_analyze_failed (' + res.status + ')'));
    return data;
  }

  // Spatial-split a stem. Async start/check pattern, same as separate().
  // opts: {
  //   sourceUrl,                  // R2 URL of the stem (or full mix) to split
  //   sourceStemId, sourceLabel,  // for record-keeping (e.g. 'other', 'guitar')
  //   panWindows: [{ name, pan_min, pan_max, soft_width?, fingerprint_ref? }],
  //   references: { name: { mean:[], std:[] } } | null,
  //   fpStrength: 0..1,
  //   onProgress
  // }
  async function spatialSplit(title, opts) {
    if (!title) throw new Error('title required');
    opts = opts || {};
    if (!opts.sourceUrl) throw new Error('opts.sourceUrl required');
    if (!Array.isArray(opts.panWindows) || opts.panWindows.length === 0)
      throw new Error('opts.panWindows required');
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function(){};
    var startedAt = Date.now();

    onProgress('starting', 0);
    var startRes = await fetch(_workerBase() + '/stems/spatial/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId: _stemsKey(title),
        sourceUrl: opts.sourceUrl,
        panWindows: opts.panWindows,
        references: opts.references || null,
        fpStrength: typeof opts.fpStrength === 'number' ? opts.fpStrength : 0.5,
        pathPrefix: opts.pathPrefix || ('spatial-' + (opts.sourceStemId || 'mix')),
      }),
    });
    var startData = null;
    try { startData = await startRes.json(); } catch (e) {}
    if (!startData || !startData.success)
      throw new Error((startData && startData.error) || ('spatial_start_failed (' + startRes.status + ')'));
    var callId = startData.call_id;
    if (!callId) throw new Error('No call_id from /stems/spatial/start');

    onProgress('processing', 0);
    var pollStart = Date.now();
    var maxPollMs = 10 * 60 * 1000;
    var data = null;
    while (true) {
      if (Date.now() - pollStart > maxPollMs) throw new Error('Spatial split timed out (>10min)');
      await new Promise(function(r) { setTimeout(r, 4000); });
      var checkRes = await fetch(_workerBase() + '/stems/spatial/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: callId }),
      });
      var checkData = null;
      try { checkData = await checkRes.json(); } catch (e) {}
      if (!checkData || !checkData.success)
        throw new Error((checkData && checkData.error) || ('spatial_check_failed (' + checkRes.status + ')'));
      if (checkData.status === 'processing') {
        // Spatial split is fast (~30-90s); use raw seconds against an 80s
        // typical to drive the bar. Caps at 95%.
        var pct = Math.min(95, Math.round(((Date.now() - pollStart) / 1000) / 80 * 100));
        onProgress('processing', pct);
        continue;
      }
      if (checkData.status === 'done') {
        onProgress('finalizing', 100);
        data = checkData;
        break;
      }
    }

    var record = {
      stems: data.stems,
      sample_rate: data.sample_rate,
      panWindows: opts.panWindows,
      references: opts.references || null,
      fpStrength: typeof opts.fpStrength === 'number' ? opts.fpStrength : 0.5,
      sourceUrl: opts.sourceUrl,
      sourceStemId: opts.sourceStemId || null,
      sourceLabel: opts.sourceLabel || (opts.sourceStemId || 'mix'),
      separatedAt: new Date().toISOString(),
      elapsedSec: (Date.now() - startedAt) / 1000,
    };
    // Spatial-split is per-song. Multiple splits per song are possible (Drew
    // might split "other" AND "guitar"), so we keep an array indexed by
    // sourceStemId. Newest wins per stem id.
    var existing = await getSpatialSplits(title);
    var idx = existing.findIndex(function(r) { return r.sourceStemId === record.sourceStemId; });
    if (idx >= 0) existing[idx] = record;
    else existing.push(record);
    if (typeof saveBandDataToDrive === 'function') {
      try { await saveBandDataToDrive(title, 'spatial_split', existing); } catch (e) {}
    }
    return record;
  }

  async function getSpatialSplits(title) {
    if (!title || typeof loadBandDataFromDrive !== 'function') return [];
    try {
      var d = await loadBandDataFromDrive(title, 'spatial_split');
      if (Array.isArray(d)) return d;
      // Backwards-compat: single record stored as object
      if (d && typeof d === 'object' && d.stems) return [d];
      return [];
    } catch (e) { return []; }
  }

  async function clearSpatialSplits(title) {
    if (typeof saveBandDataToDrive !== 'function') return;
    try { await saveBandDataToDrive(title, 'spatial_split', null); } catch (e) {}
  }

  async function clearSpatialSplitFor(title, sourceStemId) {
    var existing = await getSpatialSplits(title);
    var filtered = existing.filter(function(r) { return r.sourceStemId !== sourceStemId; });
    if (filtered.length === existing.length) return;
    if (typeof saveBandDataToDrive === 'function') {
      await saveBandDataToDrive(title, 'spatial_split', filtered.length ? filtered : null);
    }
  }

  return {
    getStems: getStems,
    hasStems: hasStems,
    separate: separate,
    clearStems: clearStems,
    // Stab #14 — job persistence + cancellation + resume
    getActiveJobs: getActiveJobs,
    cancelJob: cancelJob,
    resumeJob: _resumeJob,
    getStats: getStats,
    // Phase 2: Spatial split (pan + fingerprint)
    fingerprintTone: fingerprintTone,
    loadFingerprints: loadFingerprints,
    saveFingerprint: saveFingerprint,
    deleteFingerprint: deleteFingerprint,
    analyzePan: analyzePan,
    spatialSplit: spatialSplit,
    getSpatialSplits: getSpatialSplits,
    clearSpatialSplits: clearSpatialSplits,
    clearSpatialSplitFor: clearSpatialSplitFor,
    // LALAL.AI lead/backing
    getLeadBackingSplit: getLeadBackingSplit,
    hasLeadBackingSplit: hasLeadBackingSplit,
    splitLeadBacking: splitLeadBacking,
    clearLeadBackingSplit: clearLeadBackingSplit
  };
})();
