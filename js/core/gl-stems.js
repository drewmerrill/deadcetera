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

  // opts: { sourceUrl?, driveFileId?, accessToken?, audioDataUrl?, sourceLabel? }
  async function separate(title, opts) {
    if (!title) throw new Error('title required');
    opts = opts || {};
    var body = { songId: _stemsKey(title) };
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
    if (typeof saveBandDataToDrive === 'function') {
      try { await saveBandDataToDrive(title, 'stems', record); } catch (e) {}
    }
    return record;
  }

  async function clearStems(title) {
    if (typeof saveBandDataToDrive !== 'function') return;
    try { await saveBandDataToDrive(title, 'stems', null); } catch (e) {}
  }

  return {
    getStems: getStems,
    hasStems: hasStems,
    separate: separate,
    clearStems: clearStems
  };
})();
