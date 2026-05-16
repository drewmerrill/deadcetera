// =============================================================================
// js/core/gl-recordings.js — Phase 3C Recording Identity + Playback Resolver
//
// Canonical Recording primitive + the single playback-resolution path that
// every consumer (Take Review, Tonight's progress, future Phase 4+ surfaces)
// should call when it needs "what URL do I play for this session?"
//
// Storage:
//   bands/{slug}/recordings/{recordingId}
//
// Shape:
//   {
//     id,
//     rehearsal_id,         // FK back to rehearsal_sessions/{sessionId}
//     title,
//     source_type,          // 'upload' | 'mixdown' | 'drive' | 'external' | 'transient'
//     source_origin,        // 'session_blob' | 'google_drive' | 'gcs' | 'http' |
//                           // 'mixdown_drive' | 'mixdown_inline' | 'unknown' | 'none'
//     audio_url,            // canonical playback URL (non-blob preferred)
//     storage_ref?,         // optional opaque storage reference (future Storage backend)
//     drive_file_id?,       // for Drive-backed recordings
//     duration_sec?,
//     uploaded_by?,         // memberKey of the uploader
//     uploaded_at,          // ms timestamp
//     analysis_status,      // 'unknown' | 'pending' | 'analyzed' | 'failed'
//     waveform_status,      // 'none' | 'pending' | 'ready'
//     metadata: {
//       mime_type?, file_size?, original_filename?, mixdown_id?
//     },
//     archived,
//     created_at,
//     updated_at
//   }
//
// Resolver priority (resolvePlaybackSource):
//   1. session.recording_id → load canonical Recording → use its audio_url
//   2. session.recording_url (non-blob) → return it; opportunistically
//      auto-create a Recording record and stamp session.recording_id back
//   3. rehearsal_mixdowns/* matched by session.date → use mixdown audio_url
//      (preferring non-blob) or drive_url; opportunistically auto-create
//   4. session.recording_url (blob) → return as transient (isBlob: true)
//   5. nothing → return null source
//
// Auto-create is the additive normalization the Phase 3C spec asked for:
// legacy sessions grow canonical Recording records on first playback resolve
// without breaking anything that still reads session.recording_url directly.
//
// Indexing: deliberately none yet. Same scaling stance as gl-annotations.js
// and gl-takes.js — load-all-and-filter is fine at MVP scale.
// =============================================================================

(function () {
  'use strict';

  var _cache = null;
  var _cacheLoadedAt = 0;
  var _loadInFlight = null;

  // Per-session resolution cache prevents redundant Firebase reads within
  // a render pass. Cleared whenever the underlying Recording cache reloads.
  var _resolveCache = {};

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath('recordings' + (suffix ? '/' + suffix : ''));
  }

  function _isBlobUrl(url) {
    return !!(url && typeof url === 'string' && url.indexOf('blob:') === 0);
  }

  function _classifyOrigin(url) {
    if (!url) return 'none';
    if (_isBlobUrl(url)) return 'session_blob';
    if (url.indexOf('drive.google') !== -1) return 'google_drive';
    if (url.indexOf('storage.googleapis') !== -1) return 'gcs';
    if (url.indexOf('http') === 0) return 'http';
    return 'unknown';
  }

  function _ensureLoaded(force) {
    if (!force && _cache && (Date.now() - _cacheLoadedAt) < 60000) {
      return Promise.resolve(_cache);
    }
    if (_loadInFlight) return _loadInFlight;
    var db = _db();
    var p = _path('');
    if (!db || !p) {
      _cache = {};
      _cacheLoadedAt = Date.now();
      return Promise.resolve(_cache);
    }
    _loadInFlight = db.ref(p).once('value').then(function (snap) {
      _cache = snap.val() || {};
      _cacheLoadedAt = Date.now();
      _resolveCache = {}; // invalidate when underlying records reload
      _loadInFlight = null;
      return _cache;
    }).catch(function (err) {
      console.warn('[GLRecordings] load failed:', err && err.message);
      _loadInFlight = null;
      _cache = _cache || {};
      return _cache;
    });
    return _loadInFlight;
  }

  // ── CRUD ────────────────────────────────────────────────────────────────
  function createRecording(input) {
    input = input || {};
    var db = _db();
    var p = _path('');
    if (!db || !p) return Promise.reject(new Error('[GLRecordings] firebase not ready'));

    var now = Date.now();
    var rec = {
      id: '',
      rehearsal_id: input.rehearsal_id || null,
      title: input.title || null,
      source_type: input.source_type || 'upload',
      source_origin: input.source_origin || _classifyOrigin(input.audio_url || ''),
      audio_url: input.audio_url || null,
      storage_ref: input.storage_ref || null,
      drive_file_id: input.drive_file_id || null,
      duration_sec: typeof input.duration_sec === 'number' ? input.duration_sec : null,
      uploaded_by: input.uploaded_by || null,
      uploaded_at: input.uploaded_at || now,
      analysis_status: input.analysis_status || 'unknown',
      waveform_status: input.waveform_status || 'none',
      metadata: input.metadata || {},
      archived: false,
      created_at: now,
      updated_at: now
    };
    var ref = db.ref(p).push();
    rec.id = ref.key;
    return ref.set(rec).then(function () {
      if (_cache) _cache[rec.id] = rec;
      return rec;
    });
  }

  function updateRecording(id, patch) {
    if (!id) return Promise.reject(new Error('[GLRecordings] id required'));
    patch = patch || {};
    var db = _db();
    var p = _path(id);
    if (!db || !p) return Promise.reject(new Error('[GLRecordings] firebase not ready'));

    var safe = {};
    [
      'rehearsal_id', 'title', 'source_type', 'source_origin',
      'audio_url', 'storage_ref', 'drive_file_id', 'duration_sec',
      'analysis_status', 'waveform_status', 'archived'
    ].forEach(function (k) {
      if (patch[k] !== undefined) safe[k] = patch[k];
    });
    if (patch.metadata && typeof patch.metadata === 'object') {
      safe.metadata = patch.metadata;
    }
    safe.updated_at = Date.now();

    return db.ref(p).update(safe).then(function () {
      if (_cache && _cache[id]) {
        Object.keys(safe).forEach(function (k) { _cache[id][k] = safe[k]; });
      }
      // Invalidate any cached resolutions that might reference this record.
      _resolveCache = {};
      return _cache ? _cache[id] : null;
    });
  }

  function getRecording(id, opts) {
    opts = opts || {};
    if (!id) return Promise.resolve(null);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      return cache[id] || null;
    });
  }

  function getRecordingsForRehearsal(rehearsalId, opts) {
    opts = opts || {};
    if (!rehearsalId) return Promise.resolve([]);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var r = cache[id];
        if (!r || r.archived) return;
        if (r.rehearsal_id === rehearsalId) out.push(r);
      });
      out.sort(function (a, b) { return (b.uploaded_at || 0) - (a.uploaded_at || 0); });
      return out;
    });
  }

  // ── Mixdown discovery (legacy bridge) ───────────────────────────────────
  // Mixdowns live at `bands/{slug}/rehearsal_mixdowns/{mxId}` with a
  // `rehearsal_date` string. The first persistent match wins; multiple
  // mixdowns per session-date is logged as a deferred finding.
  function _findMixdownForSession(session) {
    if (!session || !session.date) return Promise.resolve(null);
    var db = _db();
    if (!db || typeof bandPath !== 'function') return Promise.resolve(null);
    return db.ref(bandPath('rehearsal_mixdowns')).once('value').then(function (snap) {
      var all = snap.val() || {};
      var hit = null;
      Object.keys(all).forEach(function (mxId) {
        var mx = all[mxId];
        if (!mx) return;
        if (mx.rehearsal_date !== session.date) return;
        if (hit) return;
        var url = (mx.audio_url && !_isBlobUrl(mx.audio_url)) ? mx.audio_url : mx.drive_url;
        if (url) { mx.id = mxId; hit = mx; }
      });
      return hit;
    }).catch(function () { return null; });
  }

  // ── Auto-create helpers (additive normalization) ────────────────────────
  // Both write a new Recording record AND stamp `recording_id` back on the
  // session, so subsequent resolves skip directly to Path 1. Fire-and-forget
  // wouldn't work cleanly because we want the recordingId in the resolver
  // response, so we await.

  function _ensureRecordingForSession(session, sessUrl) {
    if (!session || !session.sessionId) return Promise.resolve(null);
    return createRecording({
      rehearsal_id: session.sessionId,
      title: session.date ? 'Rehearsal recording — ' + session.date : 'Rehearsal recording',
      source_type: 'upload',
      source_origin: _classifyOrigin(sessUrl),
      audio_url: sessUrl,
      duration_sec: session.totalActualMin ? session.totalActualMin * 60 : null,
      analysis_status: (session.audio_segments) ? 'analyzed' : 'unknown'
    }).then(function (rec) {
      // Stamp back onto the session.
      var db = _db();
      var setPromise = (db && typeof bandPath === 'function')
        ? db.ref(bandPath('rehearsal_sessions/' + session.sessionId + '/recording_id')).set(rec.id)
        : Promise.resolve();
      return setPromise.then(function () {
        session.recording_id = rec.id;
        if (window.GLObs && window.GLObs.log) {
          window.GLObs.log('GLRecordings', 'auto-created from session.recording_url', {
            rehearsal_id: session.sessionId,
            recording_id: rec.id,
            origin: rec.source_origin
          });
        }
        return rec;
      }).catch(function () { return rec; });
    }).catch(function () { return null; });
  }

  function _ensureRecordingForMixdown(session, mx) {
    if (!session || !session.sessionId || !mx) return Promise.resolve(null);
    var mxUrl = (mx.audio_url && !_isBlobUrl(mx.audio_url)) ? mx.audio_url : mx.drive_url;
    var isDrive = !!(mx.drive_url && mxUrl === mx.drive_url);
    return createRecording({
      rehearsal_id: session.sessionId,
      title: mx.title || 'Mixdown — ' + (session.date || mx.rehearsal_date || ''),
      source_type: 'mixdown',
      source_origin: isDrive ? 'mixdown_drive' : 'mixdown_inline',
      audio_url: mxUrl,
      drive_file_id: mx.drive_file_id || null,
      duration_sec: mx.duration || null,
      analysis_status: 'unknown',
      metadata: {
        original_filename: mx.drive_file_name || null,
        mixdown_id: mx.id || null
      }
    }).then(function (rec) {
      var db = _db();
      var setPromise = (db && typeof bandPath === 'function')
        ? db.ref(bandPath('rehearsal_sessions/' + session.sessionId + '/recording_id')).set(rec.id)
        : Promise.resolve();
      return setPromise.then(function () {
        session.recording_id = rec.id;
        if (window.GLObs && window.GLObs.log) {
          window.GLObs.log('GLRecordings', 'auto-created from mixdown', {
            rehearsal_id: session.sessionId,
            recording_id: rec.id,
            mixdown_id: mx.id
          });
        }
        return rec;
      }).catch(function () { return rec; });
    }).catch(function () { return null; });
  }

  // ── Central playback resolver ───────────────────────────────────────────
  // Returns:
  //   {
  //     url:           string  ('' if no source)
  //     origin:        string  (see _classifyOrigin)
  //     isBlob:        boolean (true if blob URL — session-scoped only)
  //     hasPersistent: boolean (true iff url is durable across sessions)
  //     recordingId?:  string  (when canonical Recording exists or was created)
  //     recording?:    object  (full Recording record when available)
  //     mixdownId?:    string  (only on path 3 — mixdown hits)
  //     reason:        string  ('canonical_recording' | 'session_recording_url' |
  //                             'mixdown_match' | 'session_blob' | 'no_source' |
  //                             'no_session')
  //   }
  //
  // opts:
  //   autoCreate:  false to skip the auto-create writeback (default: true)
  //   allowMixdown: false to skip Path 3 (default: true)
  function resolvePlaybackSource(session, opts) {
    opts = opts || {};
    if (!session) {
      return Promise.resolve({
        url: '', origin: 'none', isBlob: false, hasPersistent: false, reason: 'no_session'
      });
    }
    var cacheKey = session.sessionId
      ? session.sessionId + (opts.autoCreate === false ? ':noac' : '') + (opts.allowMixdown === false ? ':nomx' : '')
      : null;
    if (cacheKey && _resolveCache[cacheKey]) return Promise.resolve(_resolveCache[cacheKey]);

    function _store(result) {
      if (cacheKey) _resolveCache[cacheKey] = result;
      return result;
    }

    // ── Path 1: explicit recording_id ────────────────────────────────────
    var p1 = session.recording_id
      ? getRecording(session.recording_id).then(function (rec) {
          if (!rec || !rec.audio_url) return null;
          return _store({
            url: rec.audio_url,
            origin: _classifyOrigin(rec.audio_url),
            isBlob: _isBlobUrl(rec.audio_url),
            hasPersistent: !_isBlobUrl(rec.audio_url),
            recordingId: rec.id,
            recording: rec,
            reason: 'canonical_recording'
          });
        }).catch(function () { return null; })
      : Promise.resolve(null);

    return p1.then(function (hit1) {
      if (hit1) return hit1;

      // ── Path 2: session.recording_url, persistent ─────────────────────
      var sessUrl = session.recording_url || '';
      if (sessUrl && !_isBlobUrl(sessUrl)) {
        if (session.recording_id || opts.autoCreate === false) {
          return _store({
            url: sessUrl,
            origin: _classifyOrigin(sessUrl),
            isBlob: false,
            hasPersistent: true,
            recordingId: session.recording_id || null,
            reason: 'session_recording_url'
          });
        }
        return _ensureRecordingForSession(session, sessUrl).then(function (rec) {
          return _store({
            url: sessUrl,
            origin: _classifyOrigin(sessUrl),
            isBlob: false,
            hasPersistent: true,
            recordingId: rec ? rec.id : null,
            recording: rec || null,
            reason: 'session_recording_url'
          });
        });
      }

      // ── Path 3: Mixdown discovery by date match ───────────────────────
      var p3 = (session.date && opts.allowMixdown !== false)
        ? _findMixdownForSession(session)
        : Promise.resolve(null);

      return p3.then(function (mx) {
        if (mx) {
          var mxUrl = (mx.audio_url && !_isBlobUrl(mx.audio_url)) ? mx.audio_url : mx.drive_url;
          if (mxUrl) {
            var origin = (mx.drive_url && mxUrl === mx.drive_url) ? 'mixdown_drive' : 'mixdown_inline';
            if (session.recording_id || opts.autoCreate === false) {
              return _store({
                url: mxUrl, origin: origin, isBlob: false, hasPersistent: true,
                recordingId: session.recording_id || null,
                mixdownId: mx.id, reason: 'mixdown_match'
              });
            }
            return _ensureRecordingForMixdown(session, mx).then(function (rec) {
              return _store({
                url: mxUrl, origin: origin, isBlob: false, hasPersistent: true,
                recordingId: rec ? rec.id : null,
                recording: rec || null,
                mixdownId: mx.id, reason: 'mixdown_match'
              });
            });
          }
        }

        // ── Path 4: blob fallback (transient) ───────────────────────────
        if (sessUrl && _isBlobUrl(sessUrl)) {
          return _store({
            url: sessUrl, origin: 'session_blob', isBlob: true,
            hasPersistent: false, reason: 'session_blob'
          });
        }

        // ── Path 5: nothing ─────────────────────────────────────────────
        return _store({
          url: '', origin: 'none', isBlob: false, hasPersistent: false,
          reason: 'no_source'
        });
      });
    });
  }

  // ── Normalize any input shape to a stable {recording_id, audio_url, origin}
  // For consumers that need a one-liner contract instead of a full async
  // resolver. Synchronous; does NOT do auto-create.
  function normalizeRecordingReference(input) {
    if (!input) return { recording_id: null, audio_url: '', origin: 'none' };
    if (typeof input === 'string') {
      return { recording_id: null, audio_url: input, origin: _classifyOrigin(input) };
    }
    // Take object (Phase 2): playback_ref may carry a recording_id.
    if (input.playback_ref) {
      var rid = input.playback_ref.recording_id || input.recording_id || null;
      return {
        recording_id: rid,
        audio_url: null,
        origin: rid ? 'canonical_recording' : 'none'
      };
    }
    // Recording record itself.
    if (input.audio_url !== undefined && input.source_origin !== undefined) {
      return {
        recording_id: input.id || null,
        audio_url: input.audio_url || '',
        origin: input.source_origin || _classifyOrigin(input.audio_url || '')
      };
    }
    // Session.
    if (input.sessionId !== undefined || input.recording_url !== undefined || input.recording_id !== undefined) {
      return {
        recording_id: input.recording_id || null,
        audio_url: input.recording_url || '',
        origin: _classifyOrigin(input.recording_url || '')
      };
    }
    return { recording_id: null, audio_url: '', origin: 'none' };
  }

  function refreshCache() { return _ensureLoaded(true); }

  // ── Wire to window ──────────────────────────────────────────────────────
  window.GLRecordings = {
    // CRUD
    createRecording:            createRecording,
    updateRecording:            updateRecording,
    getRecording:               getRecording,
    getRecordingsForRehearsal:  getRecordingsForRehearsal,
    // Resolution
    resolvePlaybackSource:      resolvePlaybackSource,
    normalizeRecordingReference: normalizeRecordingReference,
    // Cache control
    refreshCache:               refreshCache
  };

  console.log('✅ GLRecordings initialised');
})();
