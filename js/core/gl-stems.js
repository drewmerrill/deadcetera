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
  //         firebaseAudioRef?, sourceLabel?, model? }
  // model: 'htdemucs' (4 stems), 'htdemucs_6s' (6 stems, default),
  //        'htdemucs_ft' (4 stems HQ, ~3-4× slower),
  //        'mdx_extra' (4 stems MDX architecture, ~1.5× slower)
  // firebaseAudioRef: optional `firebase-audio://...` pointer saved alongside
  //   the audioDataUrl so a future re-separate can re-fetch the base64
  //   without forcing the user to re-pick the take.
  var ALLOWED_MODELS = ['htdemucs', 'htdemucs_6s', 'htdemucs_ft', 'mdx_extra'];
  async function separate(title, opts) {
    if (!title) throw new Error('title required');
    opts = opts || {};
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

    var res = await fetch(_workerBase() + '/stems/separate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!data) throw new Error('Bad worker response (' + res.status + ')');
    if (!data.success) throw new Error(data.error || 'separation_failed');

    var record = {
      stems: data.stems,
      sample_rate: data.sample_rate,
      model: data.model,
      separatedAt: new Date().toISOString(),
      sourceLabel: opts.sourceLabel || (opts.sourceUrl ? 'URL' : 'Drive'),
      elapsedSec: data.elapsed_sec
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
    return record;
  }

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

  return {
    getStems: getStems,
    hasStems: hasStems,
    separate: separate,
    clearStems: clearStems,
    // LALAL.AI lead/backing
    getLeadBackingSplit: getLeadBackingSplit,
    hasLeadBackingSplit: hasLeadBackingSplit,
    splitLeadBacking: splitLeadBacking,
    clearLeadBackingSplit: clearLeadBackingSplit
  };
})();
