// ── Ingest Cockpit — live visibility surface for the operator-side
//     ingest pipeline (Pass 1, Drew 2026-05-27 direction adjustment).
//
// READ-ONLY display layer. Does NOT initiate uploads. The operator script
// `services/glx-ingest/ingest_full_rehearsal.py` writes status to
// Firebase `bands/{slug}/ingest_jobs/{jobId}` as it runs; this module
// subscribes via Realtime DB `.on('value', ...)` and renders the most
// recent active job as a banner on the Rehearsal page.
//
// Design rules (per Drew 2026-05-27 UX direction):
//   - No infrastructure terminology in surface output (no "R2",
//     "multipart", "presigned URL", "Modal", "Cloudflare", "ffmpeg" —
//     those live in code comments only).
//   - Failure copy reassures: "Upload interrupted. Your rehearsal files
//     are safe. Resume upload." NOT "multipart initiation failed."
//   - Auto-hides when there is no active job. No dead tile.
//   - Hides "ready" jobs after ~10 minutes (the celebration moment
//     fades; the session itself lives on in the rehearsal history).
//   - Subscribes per-render; no global listener leak.
//
// Public API (called by rehearsal.js):
//   _glIngestCockpitMount(containerEl, bandSlug)  — wire up + subscribe
//   _glIngestCockpitUnmount(containerEl)          — clean up listener

(function () {
  'use strict';

  // Hide a "ready" job from the cockpit after this many ms — the
  // celebration moment is finite; the session itself stays in History.
  var READY_DISPLAY_TTL_MS = 10 * 60 * 1000;

  // Drop any job older than this regardless of status — stale rows
  // from crashed scripts shouldn't haunt the surface forever.
  var MAX_DISPLAY_AGE_MS = 12 * 60 * 60 * 1000;  // 12h

  // Single global state per container (last subscription handle, last
  // render snapshot) so multiple mount/unmount cycles don't leak.
  var _mounts = new WeakMap();

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _bandPath(p) {
    if (typeof bandPath === 'function') return bandPath(p);
    // Fallback for cached shells where bandPath isn't defined yet.
    return '/bands/deadcetera/' + p;
  }

  // ── Job selection — pick the most-relevant job to display ──────────────

  function _selectActiveJob(jobsMap) {
    if (!jobsMap || typeof jobsMap !== 'object') return null;
    var now = Date.now();
    var best = null;
    Object.keys(jobsMap).forEach(function (jobId) {
      var job = jobsMap[jobId];
      if (!job || typeof job !== 'object') return;
      var updatedAt = Date.parse(job.updatedAt || job.startedAt || 0);
      if (isNaN(updatedAt)) updatedAt = 0;
      var age = now - updatedAt;
      if (age > MAX_DISPLAY_AGE_MS) return;
      // Suppress "ready" jobs after their celebration TTL
      if (job.status === 'ready' && age > READY_DISPLAY_TTL_MS) return;
      // Pick the most recently updated active job
      if (!best || updatedAt > best._updatedAt) {
        best = Object.assign({}, job, {
          jobId: jobId,
          _updatedAt: updatedAt,
        });
      }
    });
    return best;
  }

  // ── Render ─────────────────────────────────────────────────────────────

  function _esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function _fmtElapsed(seconds) {
    if (!seconds || seconds < 0) return '';
    if (seconds < 60) return Math.round(seconds) + 's';
    if (seconds < 3600) {
      var m = Math.floor(seconds / 60);
      var s = Math.round(seconds - m * 60);
      return m + 'm ' + s + 's';
    }
    var h = Math.floor(seconds / 3600);
    var rem = seconds - h * 3600;
    var hm = Math.floor(rem / 60);
    return h + 'h ' + hm + 'm';
  }

  function _statusAccent(status) {
    switch (status) {
      case 'preparing':  return { color: '#a5b4fc', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.30)' };
      case 'uploading':  return { color: '#fbbf24', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.30)' };
      case 'processing': return { color: '#818cf8', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.30)' };
      case 'ready':      return { color: '#86efac', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.35)' };
      case 'failed':     return { color: '#fca5a5', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.30)' };
      default:           return { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)' };
    }
  }

  function _renderChecklist(checklist) {
    if (!checklist || typeof checklist !== 'object') return '';
    // Musician-facing labels in order of natural progression
    var order = [
      ['chunksVerified',     'Recording chunks verified'],
      ['hexOrderConfirmed',  'Order confirmed'],
      ['noMissingChunks',    'No missing pieces'],
      ['channelsDetected',   'Channels detected'],
      ['durationVerified',   'Duration verified'],
      ['uploadComplete',     'Upload complete'],
      ['stemsGenerated',     'Instrument tracks built'],
      ['mixRendered',        'Rehearsal mix rendered'],
      ['sessionCreated',     'Session ready in GrooveLinx'],
    ];
    var html = '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:0.74em;color:var(--text-dim,#94a3b8)">';
    order.forEach(function (pair) {
      var done = !!checklist[pair[0]];
      var icon = done ? '<span style="color:#86efac">✓</span>' : '<span style="opacity:0.35">○</span>';
      var color = done ? 'var(--text,#cbd5e1)' : 'var(--text-dim,#64748b)';
      html += '<span style="display:inline-flex;align-items:center;gap:5px;color:' + color + '">'
            + icon + ' ' + _esc(pair[1]) + '</span>';
    });
    html += '</div>';
    return html;
  }

  function _renderProgressBar(pct) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    var bar_width = 100;
    return '<div style="margin-top:10px;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">'
         + '  <div style="width:' + pct.toFixed(1) + '%;height:100%;background:linear-gradient(90deg,#818cf8,#a5b4fc);transition:width 0.4s ease"></div>'
         + '</div>';
  }

  function _renderJob(job) {
    if (!job) return '';  // empty = container hidden
    var accent = _statusAccent(job.status);
    var phase = _esc(job.phaseLabel || job.status || 'Preparing rehearsal');
    var statusBadge = '';
    if (job.status === 'ready') statusBadge = ' · <span style="color:#86efac">Ready</span>';
    else if (job.status === 'failed') statusBadge = ' · <span style="color:#fca5a5">Paused</span>';

    var contextLine = '';
    var contextParts = [];
    if (job.sourceLabel) contextParts.push(_esc(job.sourceLabel));
    if (job.durationLabel) contextParts.push(_esc(job.durationLabel));
    if (job.channelCount) contextParts.push(_esc(job.channelCount) + ' channels');
    if (job.trackCount && job.trackCount > 0) {
      contextParts.push(_esc(job.trackCount) + ' tracks');
    }
    if (contextParts.length) {
      contextLine = '<div style="font-size:0.78em;color:var(--text-dim,#94a3b8);margin-top:3px">'
                  + contextParts.join(' · ') + '</div>';
    }

    var progressLine = '';
    var showProgress = (job.status === 'uploading' || job.status === 'processing');
    if (showProgress && (job.progressPct != null)) {
      progressLine += _renderProgressBar(job.progressPct);
      var timingBits = [];
      timingBits.push(Math.round(job.progressPct || 0) + '%');
      if (job.elapsedSec) timingBits.push(_fmtElapsed(job.elapsedSec) + ' elapsed');
      if (job.estimatedRemainingSec && job.estimatedRemainingSec > 0) {
        timingBits.push('~' + _fmtElapsed(job.estimatedRemainingSec) + ' remaining');
      }
      progressLine += '<div style="font-size:0.72em;color:var(--text-dim,#94a3b8);margin-top:6px;font-variant-numeric:tabular-nums">'
                    + timingBits.join(' · ')
                    + '</div>';
    }

    var ctaLine = '';
    if (job.status === 'ready' && job.sessionId) {
      var sidSafe = _esc(job.sessionId);
      ctaLine = '<div style="margin-top:12px">'
              + '<button onclick="window._mtOpenPlayer && window._mtOpenPlayer(\'' + sidSafe + '\')" '
              +  'style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.45);'
              +  'color:#86efac;padding:8px 14px;border-radius:8px;font-weight:700;'
              +  'font-size:0.86em;font-family:inherit;cursor:pointer">'
              + '🎧 Open Review Mode →</button></div>';
    } else if (job.status === 'failed') {
      var emsg = _esc(job.errorMessage || 'Processing paused. Your rehearsal files are safe.');
      ctaLine = '<div style="margin-top:10px;font-size:0.84em;color:#fecaca">'
              + emsg + '</div>';
    }

    var html = ''
      + '<div style="padding:14px 16px;border-radius:12px;'
      + 'background:' + accent.bg + ';'
      + 'border:1px solid ' + accent.border + ';'
      + 'margin-bottom:14px">'
      + '  <div style="display:flex;align-items:center;gap:10px">'
      + '    <span style="font-size:1.3em">📥</span>'
      + '    <div style="flex:1;min-width:0">'
      + '      <div style="font-weight:800;font-size:0.92em;color:' + accent.color + '">'
      +        phase + statusBadge
      + '      </div>'
      +        contextLine
      + '    </div>'
      + '  </div>'
      +    progressLine
      +    _renderChecklist(job.checklist)
      +    ctaLine
      + '</div>';
    return html;
  }

  // ── Mount / unmount ────────────────────────────────────────────────────

  function _mount(containerEl, bandSlug) {
    if (!containerEl) return;
    var db = _db();
    if (!db) {
      // No Firebase available — render nothing, try again later.
      console.warn('[ingest-cockpit] Firebase not ready; will retry on next page nav');
      return;
    }
    var slug = bandSlug || (typeof currentBandSlug === 'string' ? currentBandSlug : 'deadcetera');
    var path = _bandPath('ingest_jobs');

    // Tear down any prior listener for this container.
    _unmount(containerEl);

    var ref = db.ref(path);
    var refreshTimer = null;
    var lastSnapshot = null;

    function _doRender() {
      var job = _selectActiveJob(lastSnapshot);
      containerEl.innerHTML = _renderJob(job);
      // Hide the container entirely when empty so it consumes no layout space.
      containerEl.style.display = job ? 'block' : 'none';
    }

    function _onValue(snapshot) {
      lastSnapshot = snapshot && snapshot.val ? snapshot.val() : null;
      _doRender();
      // Re-render every 5s while there's a running job so elapsed/remaining
      // ticks live. Cheap (DOM update, no network).
      if (refreshTimer) clearInterval(refreshTimer);
      var job = _selectActiveJob(lastSnapshot);
      var isLive = job && (job.status === 'uploading' || job.status === 'processing');
      if (isLive) {
        refreshTimer = setInterval(_doRender, 5000);
      }
    }

    function _onErr(err) {
      console.warn('[ingest-cockpit] firebase listener error', err);
      // Don't surface to UI — silently hide.
      containerEl.style.display = 'none';
    }

    ref.on('value', _onValue, _onErr);

    _mounts.set(containerEl, {
      ref: ref,
      onValue: _onValue,
      detach: function () {
        try { ref.off('value', _onValue); } catch (e) {}
        if (refreshTimer) clearInterval(refreshTimer);
      },
    });

    // Initial render before the first 'value' event fires (covers
    // the rare case where the ref returns no children — Firebase
    // still fires 'value' with null, so _doRender is invoked).
  }

  function _unmount(containerEl) {
    if (!containerEl) return;
    var prev = _mounts.get(containerEl);
    if (prev && typeof prev.detach === 'function') prev.detach();
    _mounts.delete(containerEl);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window._glIngestCockpitMount = _mount;
  window._glIngestCockpitUnmount = _unmount;
})();
