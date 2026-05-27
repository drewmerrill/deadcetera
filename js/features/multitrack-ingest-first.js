// ── GrooveLinx ingest-first multitrack upload (Pass 1 of the
//     Recording Ingestion Architecture, Drew 2026-05-27).
//
// Architecture position (per memory project_ingestion_first_architecture):
//
//   SD card  →  copy to local SSD
//            →  services/glx-ingest/glx_ingest.py CLI (hex-sort + safe concat)
//            →  FULL_REHEARSAL.wav + ingest_metadata.json
//            →  THIS MODULE: upload both, demux server-side, create session
//            →  Review Mode
//
// Why this is separate from multitrack-rehearsal.js:
//   That file owns the REAPER-bundle path (per-channel FLAC drag/drop +
//   wizard). This file owns the new ingest-first path (single
//   reconstructed multichannel WAV from the local CLI). Both coexist;
//   neither replaces the other in Pass 1. Drew's reframe demotes REAPER
//   from canonical to convenience; this file is the new canonical path
//   for X-Live → GrooveLinx.
//
// Pass 1 deliberate scope (per project_ingestion_first_architecture
// "How to apply"):
//   - Single-band hardcoded channel map (Deadcetera) on the server side.
//   - No channel-map UI ("premature infrastructure" — Drew 2026-05-27).
//   - Minimal upload UI: file picker + 4 phase rows + a button.
//   - Localstorage-backed job persistence for survive-reload.
//   - Reuses the existing _mtOpenPlayer + GLStore.RehearsalSession.create
//     so downstream (Review Mode, Custom Mix, comments, segmentation)
//     doesn't know whether the session came from REAPER bundle, ingest-
//     first, or any future adapter.

(function () {
  'use strict';

  var LS_KEY = 'gl_ingest_first_active_job';
  var POLL_INTERVAL_MS = 10000;     // 10s — demux is multi-minute
  var POLL_TIMEOUT_MS = 90 * 60 * 1000; // 90min cap

  var _state = {
    jobId: null,
    callId: null,
    sessionId: null,
    bandSlug: null,
    metadata: null,
    pollTimer: null,
    pollStartedAt: 0,
    modalEl: null,
  };

  function _workerBase() {
    // Match the convention used elsewhere in the app.
    return (typeof DEADCETERA_PROXY_BASE === 'string' && DEADCETERA_PROXY_BASE)
      ? DEADCETERA_PROXY_BASE
      : 'https://deadcetera-proxy.deadcetera-music.workers.dev';
  }

  function _bandSlug() {
    if (typeof GLStore !== 'undefined' && GLStore.getCurrentBandSlug) {
      return GLStore.getCurrentBandSlug() || 'deadcetera';
    }
    return (typeof currentBandSlug === 'string' && currentBandSlug) ? currentBandSlug : 'deadcetera';
  }

  function _randId(prefix) {
    return prefix + Math.random().toString(36).slice(2, 11);
  }

  function _saveActiveJob() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        jobId: _state.jobId,
        callId: _state.callId,
        sessionId: _state.sessionId,
        bandSlug: _state.bandSlug,
        metadata: _state.metadata,
        savedAt: Date.now(),
      }));
    } catch (e) {}
  }

  function _clearActiveJob() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  function _loadActiveJob() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // Stale job > 6h old — drop. Demux finishes in well under that.
      if (Date.now() - (obj.savedAt || 0) > 6 * 3600 * 1000) {
        _clearActiveJob();
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  function _buildModalHtml() {
    return ''
      + '<div id="ifModalOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:11000;display:flex;align-items:center;justify-content:center;padding:20px">'
      + '<div style="background:#0f172a;border:1px solid rgba(99,102,241,0.30);border-radius:12px;max-width:560px;width:100%;max-height:90vh;overflow:auto;color:#e2e8f0;padding:22px 24px;font-family:inherit">'
      +   '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      +     '<div style="font-size:1.05em;font-weight:800;color:#e0e7ff">📥 Upload reconstructed rehearsal</div>'
      +     '<button onclick="_ifClose()" style="background:none;border:none;color:#94a3b8;font-size:1.4em;cursor:pointer;line-height:1">✕</button>'
      +   '</div>'
      +   '<div style="font-size:0.84em;color:#94a3b8;line-height:1.45;margin-bottom:16px">'
      +     'Pre-step on your Mac: run <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px;color:#a5b4fc">python3 services/glx-ingest/glx_ingest.py /path/to/R_NNN</code> '
      +     '(after copying the SD card folder to your local SSD). That produces '
      +     '<code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px">FULL_REHEARSAL.wav</code> + '
      +     '<code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px">ingest_metadata.json</code> '
      +     'in <code style="background:rgba(99,102,241,0.12);padding:1px 6px;border-radius:4px">glx_ingest_out/</code>. Pick BOTH files below.'
      +   '</div>'
      +   '<div id="ifPickerStage">'
      +     '<input type="file" id="ifFilePicker" multiple accept=".wav,.json" style="display:block;width:100%;padding:18px;border:1.5px dashed rgba(99,102,241,0.4);border-radius:10px;background:rgba(15,23,42,0.6);color:#e2e8f0;cursor:pointer;font-family:inherit">'
      +     '<div id="ifPickerStatus" style="margin-top:12px;font-size:0.82em;color:#94a3b8;min-height:1.2em"></div>'
      +     '<button id="ifStartBtn" onclick="_ifStartUpload()" disabled style="margin-top:14px;width:100%;padding:11px 16px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);border-radius:8px;color:#a5b4fc;font-weight:700;font-size:0.92em;cursor:pointer;font-family:inherit;opacity:0.45">Start upload</button>'
      +   '</div>'
      +   '<div id="ifProgressStage" style="display:none">'
      +     '<div id="ifPhaseList" style="font-size:0.86em;line-height:1.55"></div>'
      +     '<div style="margin-top:14px;font-size:0.74em;color:#64748b">This page can be safely closed. Progress resumes when you re-open.</div>'
      +     '<button onclick="_ifClose()" style="margin-top:10px;background:none;border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:6px;padding:6px 12px;font-size:0.78em;cursor:pointer">Close</button>'
      +   '</div>'
      +   '<div id="ifDoneStage" style="display:none">'
      +     '<div style="padding:14px;border-radius:10px;background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.30);color:#bbf7d0;font-size:0.92em;font-weight:700;margin-bottom:14px">✓ Ingest complete — session ready for review</div>'
      +     '<div id="ifDoneDetail" style="font-size:0.82em;color:#cbd5e1;margin-bottom:14px"></div>'
      +     '<button onclick="_ifOpenSession()" style="width:100%;padding:11px 16px;background:rgba(99,102,241,0.25);border:1px solid rgba(99,102,241,0.55);border-radius:8px;color:#c7d2fe;font-weight:700;font-size:0.92em;cursor:pointer;font-family:inherit">Open in Review Mode →</button>'
      +   '</div>'
      +   '<div id="ifErrorStage" style="display:none">'
      +     '<div id="ifErrorDetail" style="padding:14px;border-radius:10px;background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.30);color:#fecaca;font-size:0.86em"></div>'
      +     '<button onclick="_ifClose()" style="margin-top:12px;background:none;border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:6px;padding:6px 12px;font-size:0.82em;cursor:pointer">Close</button>'
      +   '</div>'
      + '</div></div>';
  }

  window._ifOpenIngestModal = function _ifOpenIngestModal() {
    var existing = document.getElementById('ifModalOverlay');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.innerHTML = _buildModalHtml();
    var modal = wrap.firstChild;
    document.body.appendChild(modal);
    _state.modalEl = modal;

    document.getElementById('ifFilePicker').addEventListener('change', _onFilePick);

    // If a job is already in flight (from a prior browser session), jump
    // straight into progress polling.
    var resume = _loadActiveJob();
    if (resume && resume.callId) {
      _state.jobId = resume.jobId;
      _state.callId = resume.callId;
      _state.sessionId = resume.sessionId;
      _state.bandSlug = resume.bandSlug;
      _state.metadata = resume.metadata;
      _showProgressStage();
      _appendPhase('resume', 'Resuming in-flight job ' + (_state.jobId || 'unknown'));
      _startPolling();
    }
  };

  window._ifClose = function _ifClose() {
    if (_state.modalEl) {
      _state.modalEl.remove();
      _state.modalEl = null;
    }
    // Note: polling continues in background if active. The active job
    // localStorage entry survives so the user can re-open and resume.
  };

  function _onFilePick() {
    var input = document.getElementById('ifFilePicker');
    var status = document.getElementById('ifPickerStatus');
    var btn = document.getElementById('ifStartBtn');
    var files = Array.from(input.files || []);
    var wav = files.find(function (f) { return /\.wav$/i.test(f.name) && /full_rehearsal/i.test(f.name); });
    var meta = files.find(function (f) { return /ingest_metadata\.json$/i.test(f.name); });

    if (!wav || !meta) {
      status.textContent = 'Pick BOTH FULL_REHEARSAL.wav and ingest_metadata.json from the same glx_ingest_out/ folder.';
      btn.disabled = true;
      btn.style.opacity = '0.45';
      btn.style.cursor = 'not-allowed';
      return;
    }
    var gb = (wav.size / 1073741824).toFixed(2);
    status.innerHTML = '✓ <strong>' + wav.name + '</strong> (' + gb + ' GB) + <strong>' + meta.name + '</strong>';
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    _state._pendingWav = wav;
    _state._pendingMeta = meta;
  }

  function _showProgressStage() {
    document.getElementById('ifPickerStage').style.display = 'none';
    document.getElementById('ifProgressStage').style.display = 'block';
    document.getElementById('ifDoneStage').style.display = 'none';
    document.getElementById('ifErrorStage').style.display = 'none';
  }

  function _showDoneStage(result) {
    document.getElementById('ifPickerStage').style.display = 'none';
    document.getElementById('ifProgressStage').style.display = 'none';
    document.getElementById('ifErrorStage').style.display = 'none';
    var done = document.getElementById('ifDoneStage');
    done.style.display = 'block';
    var detail = document.getElementById('ifDoneDetail');
    var nTracks = (result && result.totalChannels) || 0;
    var tm = (result && result.phaseTiming) || {};
    detail.textContent = nTracks + ' channels demuxed · download '
      + (tm.downloadSec || '?') + 's · demux '
      + (tm.demuxSec || '?') + 's · upload '
      + (tm.uploadSec || '?') + 's';
  }

  function _showErrorStage(msg) {
    document.getElementById('ifPickerStage').style.display = 'none';
    document.getElementById('ifProgressStage').style.display = 'none';
    document.getElementById('ifDoneStage').style.display = 'none';
    var err = document.getElementById('ifErrorStage');
    err.style.display = 'block';
    document.getElementById('ifErrorDetail').textContent = String(msg || 'unknown error');
  }

  var _phaseRows = {};
  function _appendPhase(key, label) {
    if (!_state.modalEl) return;
    var list = document.getElementById('ifPhaseList');
    if (!list) return;
    if (_phaseRows[key]) {
      _phaseRows[key].textContent = label;
      return;
    }
    var row = document.createElement('div');
    row.style.cssText = 'padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)';
    row.textContent = label;
    list.appendChild(row);
    _phaseRows[key] = row;
  }

  // ── Upload + start ──────────────────────────────────────────────────────

  async function _presign(jobId, filename) {
    var res = await fetch(_workerBase() + '/multitrack/ingest/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Band-Slug': _state.bandSlug },
      body: JSON.stringify({ jobId: jobId, filename: filename }),
    });
    if (!res.ok) throw new Error('presign_failed_' + filename + ': ' + res.status);
    var json = await res.json();
    if (!json || !json.uploadUrl || !json.key) throw new Error('presign_bad_response_' + filename);
    return json;
  }

  function _xhrPut(url, blob, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
      }
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('upload_failed_' + xhr.status + ': ' + (xhr.responseText || '')));
      };
      xhr.onerror = function () { reject(new Error('upload_network_failed')); };
      xhr.send(blob);
    });
  }

  window._ifStartUpload = async function _ifStartUpload() {
    try {
      var wav = _state._pendingWav;
      var metaFile = _state._pendingMeta;
      if (!wav || !metaFile) return;

      // Read + sanity-check metadata.
      var metaText = await metaFile.text();
      var meta;
      try { meta = JSON.parse(metaText); } catch (e) { throw new Error('ingest_metadata.json is not valid JSON'); }
      if (!meta || meta.source !== 'x32-xlive') throw new Error('metadata.source must be "x32-xlive" (got ' + (meta && meta.source) + ')');
      if (!meta.sessionId) throw new Error('metadata.sessionId missing');
      if (!meta.continuityVerified) {
        // Allow proceeding but warn.
        console.warn('[ingest-first] continuity NOT verified per metadata — proceeding anyway');
      }

      _state.jobId = _randId('job_');
      _state.sessionId = meta.sessionId;
      _state.bandSlug = _bandSlug();
      _state.metadata = meta;
      _saveActiveJob();

      _showProgressStage();
      _appendPhase('presign', 'Requesting upload URL…');

      var wavSign = await _presign(_state.jobId, 'FULL_REHEARSAL.wav');
      var metaSign = await _presign(_state.jobId, 'ingest_metadata.json');

      _appendPhase('uploadMeta', 'Uploading metadata…');
      await _xhrPut(metaSign.uploadUrl, new Blob([metaText], { type: 'application/json' }));

      _appendPhase('uploadWav', 'Uploading FULL_REHEARSAL.wav 0%…');
      await _xhrPut(wavSign.uploadUrl, wav, function (loaded, total) {
        var pct = total ? Math.round((loaded / total) * 100) : 0;
        var mb = (loaded / 1048576).toFixed(1);
        var totalGb = (total / 1073741824).toFixed(2);
        _appendPhase('uploadWav', 'Uploading FULL_REHEARSAL.wav ' + pct + '% (' + mb + ' MB of ' + totalGb + ' GB)');
      });
      _appendPhase('uploadWav', '✓ Upload complete (' + (wav.size / 1073741824).toFixed(2) + ' GB)');

      _appendPhase('demuxStart', 'Invoking demuxer…');
      var startRes = await fetch(_workerBase() + '/multitrack/ingest/from_concat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bandSlug: _state.bandSlug,
          sessionId: _state.sessionId,
          stagedWavKey: wavSign.key,
          ingestMetadata: meta,
          progressId: _state.sessionId,
        }),
      });
      if (!startRes.ok) {
        var t = await startRes.text();
        throw new Error('demux_start_failed: ' + startRes.status + ' ' + t.slice(0, 200));
      }
      var startJson = await startRes.json();
      if (!startJson || !startJson.success || !startJson.call_id) {
        throw new Error('demux_start_bad_response: ' + JSON.stringify(startJson).slice(0, 200));
      }
      _state.callId = startJson.call_id;
      _saveActiveJob();
      _appendPhase('demuxStart', '✓ Demuxer started (call_id=' + _state.callId + ')');
      _startPolling();
    } catch (e) {
      console.error('[ingest-first] start failed:', e);
      _clearActiveJob();
      _showErrorStage(e.message || String(e));
    }
  };

  // ── Polling ─────────────────────────────────────────────────────────────

  function _startPolling() {
    if (_state.pollTimer) return;
    _state.pollStartedAt = Date.now();
    _appendPhase('demuxPoll', 'Demuxing — polling every ' + (POLL_INTERVAL_MS / 1000) + 's');
    _state.pollTimer = setInterval(_poll, POLL_INTERVAL_MS);
    _poll(); // immediate first poll
  }

  function _stopPolling() {
    if (_state.pollTimer) {
      clearInterval(_state.pollTimer);
      _state.pollTimer = null;
    }
  }

  async function _poll() {
    if (Date.now() - _state.pollStartedAt > POLL_TIMEOUT_MS) {
      _stopPolling();
      _showErrorStage('demux_poll_timeout: exceeded ' + (POLL_TIMEOUT_MS / 60000) + ' min');
      return;
    }
    try {
      var res = await fetch(_workerBase() + '/multitrack/ingest/from_concat/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: _state.callId, progressId: _state.sessionId }),
      });
      if (!res.ok) {
        var t = await res.text();
        throw new Error('check_http_' + res.status + ': ' + t.slice(0, 200));
      }
      var json = await res.json();
      if (json && json.progress && json.progress.label) {
        _appendPhase('progress', 'Server: ' + json.progress.label);
      }
      if (json && json.status === 'running') return;
      if (json && json.status === 'completed' && json.result && json.result.success) {
        _stopPolling();
        await _onDemuxComplete(json.result);
        return;
      }
      if (json && json.status === 'failed') {
        _stopPolling();
        var em = (json.result && json.result.error) || json.error || 'demux_failed';
        _showErrorStage(em);
        _clearActiveJob();
        return;
      }
    } catch (e) {
      console.warn('[ingest-first] poll error (will retry):', e);
    }
  }

  // ── Session write + redirect ────────────────────────────────────────────

  async function _onDemuxComplete(result) {
    try {
      _appendPhase('write', 'Writing rehearsal_sessions/' + _state.sessionId + ' to Firebase…');
      var meta = _state.metadata || {};
      var session = {
        sessionId: _state.sessionId,
        type: 'multitrack',
        date: (meta.ingestedAt || new Date().toISOString()).slice(0, 10),
        venue: null,
        tracks: (result.tracks || []).map(function (t) {
          return {
            filename: t.filename,
            role: t.role,
            member: t.member,
            channelIndex: t.channelIndex,
            stemUrl: t.stemUrl,
            stemKey: t.stemKey,
            stemBytes: t.stemBytes,
          };
        }),
        durationSec: meta.durationSec || null,
        comments: [],
        createdAt: new Date().toISOString(),
        createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
        source: 'ingest-first-pass1',
        ingestMetadata: meta,
      };

      var written = false;
      try {
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.create) {
          await GLStore.RehearsalSession.create(_state.sessionId, session);
          written = true;
        } else {
          var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
          if (db && typeof bandPath === 'function') {
            await db.ref(bandPath('rehearsal_sessions/' + _state.sessionId)).set(session);
            written = true;
          }
        }
      } catch (e) {
        throw new Error('firebase_write_failed: ' + (e.message || e));
      }
      if (!written) throw new Error('no_session_write_path_available');

      _appendPhase('write', '✓ Session written');
      _clearActiveJob();
      _showDoneStage(result);
    } catch (e) {
      console.error('[ingest-first] post-demux finalize failed:', e);
      _showErrorStage(e.message || String(e));
    }
  }

  window._ifOpenSession = function _ifOpenSession() {
    var sid = _state.sessionId;
    _ifClose();
    if (sid && typeof window._mtOpenPlayer === 'function') {
      setTimeout(function () { window._mtOpenPlayer(sid); }, 100);
    } else if (typeof showPage === 'function') {
      showPage('rehearsal');
    }
  };

  // ── Resume on boot if a job was in flight ───────────────────────────────
  // Don't auto-open the modal; just keep state so the user re-opening the
  // ingest tile finds the in-progress job.
  if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    var resume = _loadActiveJob();
    if (resume && resume.callId) {
      console.log('[ingest-first] resuming in-flight job', resume.jobId);
    }
  }
})();
