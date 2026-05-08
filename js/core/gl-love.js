// ── Band/Audience/Personal Love + Disagreement + Preload ─────────────────────
//
// Three rating systems on the 1-5 scale:
//   1. Band Love     — band-level rating of how much the band enjoys playing it
//   2. Audience Love — band-level rating of how the crowd responds to it
//   3. Personal      — per-member overlay on each (informational; doesn't replace shared)
//
// Plus a disagreement engine that surfaces aggregate spread between the
// shared score and personal scores without exposing individual names.
//
// Plus a preload retry loop that fills all four caches from a single Firebase
// snapshot once both firebaseDB and allSongs are available.
//
// LOAD ORDER: must come after groovelinx_store.js (calls GLStore.emit and
// GLStore.getReadiness for derived status). Uses globals firebaseDB, allSongs,
// FeedActionState, showToast, renderSongs as-is.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 10) — 4 cache
// objects + 12 functions + the preload retry loop. The module owns its own
// beforeunload listener for timer cleanup; the store's _glCleanup no longer
// calls _stopLovePreload.

(function() {
  'use strict';

  // ── Local copies of store helpers (small, pure, duplicate is fine) ──────
  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }
  function _bp(subpath) {
    return (typeof bandPath === 'function') ? bandPath(subpath) : subpath;
  }
  function _sanitize(str) {
    return (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(str) : str;
  }
  function _emit(eventName, payload) {
    if (typeof window !== 'undefined' && window.GLStore && window.GLStore.emit) {
      window.GLStore.emit(eventName, payload);
    }
  }

  // ── Band Love (how much the band enjoys playing a song) ──────────────────
  // Band-level rating (not per-member). Scale 1-5.

  var _bandLoveCache = {};

  // NOTE: "songId" param is actually the song TITLE (legacy naming).
  // The cache and Firebase path use sanitized title as key.
  // This is consistent across all love functions.
  async function saveBandLove(songId, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var db = _db();
    if (!db) return;
    var k = _sanitize(songId); // songId is actually title here
    // Optimistic cache update — UI reads cache immediately after save call
    if (v === 0) { delete _bandLoveCache[songId]; } else { _bandLoveCache[songId] = v; }
    _emit('bandLoveChanged', { songId: songId, value: v });
    try {
      if (v === 0) {
        await db.ref(_bp('songs/' + k + '/bandLove')).remove();
      } else {
        await db.ref(_bp('songs/' + k + '/bandLove')).set({ score: v, updatedAt: new Date().toISOString() });
      }
      if (typeof showToast === 'function') showToast(v > 0 ? 'Love: ' + v + '/5' : 'Love cleared');
    } catch(e) {
      if (typeof showToast === 'function') showToast('Could not save');
    }
  }

  function getBandLove(songId) {
    return _bandLoveCache[songId] || 0;
  }

  function getAllBandLove() {
    return _bandLoveCache;
  }

  /**
   * Derive song status from love + readiness.
   * Core Song = high love (4+) + high readiness (4+)
   * Worth the Work = high love (4+) + low readiness (<3)
   * Utility Song = low love (<3) + high readiness (4+)
   * Shelve Candidate = low love (<3) + low readiness (<3)
   */
  function deriveSongStatus(songId) {
    var love = _bandLoveCache[songId] || 0;
    var readiness = 0;
    try {
      var GL = (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null;
      var scores = (GL && GL.getReadiness) ? GL.getReadiness(songId) : {};
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      readiness = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
    } catch(e) {}

    if (love === 0 && readiness === 0) return { status: 'unrated', label: 'Unrated', color: '#64748b' };
    if (love >= 4 && readiness >= 4) return { status: 'core', label: 'Core Song', color: '#22c55e' };
    if (love >= 4 && readiness < 3) return { status: 'worth_work', label: 'Worth the Work', color: '#f59e0b' };
    if (love < 3 && readiness >= 4) return { status: 'utility', label: 'Utility', color: '#6366f1' };
    if (love < 3 && readiness < 3) return { status: 'shelve', label: 'Shelve Candidate', color: '#ef4444' };
    // Middle ground
    if (love >= 3 && readiness >= 3) return { status: 'solid', label: 'Solid', color: '#86efac' };
    if (love >= 3) return { status: 'growing', label: 'Growing', color: '#818cf8' };
    return { status: 'developing', label: 'Developing', color: '#94a3b8' };
  }

  // Preload band love cache on boot
  async function _preloadBandLove() {
    var db = _db();
    if (!db) return;
    try {
      var snap = await db.ref(_bp('songs')).once('value');
      var data = snap.val();
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        if (data[key] && data[key].bandLove && data[key].bandLove.score) {
          // Map sanitized key back to song title
          var title = key.replace(/_/g, ' ');
          _bandLoveCache[title] = data[key].bandLove.score;
          _bandLoveCache[key] = data[key].bandLove.score; // keep both forms
        }
      });
    } catch(e) {}
  }

  // ── Audience Love (how much the crowd responds to a song) ───────────────
  // Same scale and pattern as Band Love.

  var _audienceLoveCache = {};

  async function saveAudienceLove(songId, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var db = _db();
    if (!db) return;
    var k = _sanitize(songId);
    // Optimistic cache update — UI reads cache immediately after save call
    if (v === 0) { delete _audienceLoveCache[songId]; } else { _audienceLoveCache[songId] = v; }
    _emit('audienceLoveChanged', { songId: songId, value: v });
    try {
      if (v === 0) {
        await db.ref(_bp('songs/' + k + '/audienceLove')).remove();
      } else {
        await db.ref(_bp('songs/' + k + '/audienceLove')).set({ score: v, updatedAt: new Date().toISOString() });
      }
      if (typeof showToast === 'function') showToast(v > 0 ? 'Audience: ' + v + '/5' : 'Audience love cleared');
    } catch(e) {
      if (typeof showToast === 'function') showToast('Could not save');
    }
  }

  function getAudienceLove(songId) {
    return _audienceLoveCache[songId] || 0;
  }

  function getAllAudienceLove() {
    return _audienceLoveCache;
  }

  // Preload audience love alongside band love
  async function _preloadAudienceLove() {
    var db = _db();
    if (!db) return;
    try {
      var snap = await db.ref(_bp('songs')).once('value');
      var data = snap.val();
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        if (data[key] && data[key].audienceLove && data[key].audienceLove.score) {
          var title = key.replace(/_/g, ' ');
          _audienceLoveCache[title] = data[key].audienceLove.score;
          _audienceLoveCache[key] = data[key].audienceLove.score;
        }
      });
    } catch(e) {}
  }

  // ── Personal Love Overrides + Disagreement ──────────────────────────────
  // Personal scores are per-member overlays on the shared band/audience love.
  // They do NOT replace the shared score in scoring/recommendations.
  // Firebase: songs/{key}/bandLove/personal/{memberKey} = { score, updatedAt }
  //           songs/{key}/audienceLove/personal/{memberKey} = { score, updatedAt }

  var _personalBandLoveCache = {};   // { songId: { memberKey: score } }
  var _personalAudienceLoveCache = {};

  function _myKey() {
    return (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey)
      ? FeedActionState.getMyMemberKey() : null;
  }

  async function savePersonalBandLove(songId, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var mk = _myKey(); if (!mk) return;
    var db = _db(); if (!db) return;
    var k = _sanitize(songId);
    // Optimistic cache update
    if (v === 0) {
      if (_personalBandLoveCache[songId]) delete _personalBandLoveCache[songId][mk];
    } else {
      if (!_personalBandLoveCache[songId]) _personalBandLoveCache[songId] = {};
      _personalBandLoveCache[songId][mk] = v;
    }
    _emit('personalBandLoveChanged', { songId: songId, value: v });
    try {
      if (v === 0) {
        await db.ref(_bp('songs/' + k + '/bandLove/personal/' + mk)).remove();
      } else {
        await db.ref(_bp('songs/' + k + '/bandLove/personal/' + mk)).set({ score: v, updatedAt: new Date().toISOString() });
      }
    } catch(e) {}
  }

  function getPersonalBandLove(songId, memberKey) {
    var mk = memberKey || _myKey();
    return (_personalBandLoveCache[songId] && _personalBandLoveCache[songId][mk]) || 0;
  }

  async function savePersonalAudienceLove(songId, value) {
    var v = parseInt(value, 10);
    if (isNaN(v) || v < 0 || v > 5) return;
    var mk = _myKey(); if (!mk) return;
    var db = _db(); if (!db) return;
    var k = _sanitize(songId);
    // Optimistic cache update
    if (v === 0) {
      if (_personalAudienceLoveCache[songId]) delete _personalAudienceLoveCache[songId][mk];
    } else {
      if (!_personalAudienceLoveCache[songId]) _personalAudienceLoveCache[songId] = {};
      _personalAudienceLoveCache[songId][mk] = v;
    }
    _emit('personalAudienceLoveChanged', { songId: songId, value: v });
    try {
      if (v === 0) {
        await db.ref(_bp('songs/' + k + '/audienceLove/personal/' + mk)).remove();
      } else {
        await db.ref(_bp('songs/' + k + '/audienceLove/personal/' + mk)).set({ score: v, updatedAt: new Date().toISOString() });
      }
    } catch(e) {}
  }

  function getPersonalAudienceLove(songId, memberKey) {
    var mk = memberKey || _myKey();
    return (_personalAudienceLoveCache[songId] && _personalAudienceLoveCache[songId][mk]) || 0;
  }

  // Disagreement helper — returns aggregate insight without exposing individual names
  function _computeDisagreement(sharedScore, personalCache, songId) {
    var personals = personalCache[songId];
    var myKey = _myKey();
    var myScore = (personals && myKey && personals[myKey]) || 0;
    if (!personals || Object.keys(personals).length === 0) {
      return { sharedScore: sharedScore, personalScore: myScore, delta: 0, groupSpread: 0, raterCount: 0, disagreementLevel: 'none' };
    }
    var scores = Object.values(personals).filter(function(v) { return typeof v === 'number' && v > 0; });
    var raterCount = scores.length;
    var avg = raterCount > 0 ? scores.reduce(function(a, b) { return a + b; }, 0) / raterCount : 0;
    var spread = raterCount > 1 ? Math.max.apply(null, scores) - Math.min.apply(null, scores) : 0;
    var delta = myScore > 0 ? myScore - sharedScore : 0;
    var level = 'none';
    if (Math.abs(delta) >= 3 || spread >= 3) level = 'strong';
    else if (Math.abs(delta) >= 2 || spread >= 2) level = 'notable';
    else if (Math.abs(delta) >= 1) level = 'mild';
    return {
      sharedScore: sharedScore, personalScore: myScore, delta: delta,
      avg: Math.round(avg * 10) / 10, groupSpread: spread, raterCount: raterCount,
      disagreementLevel: level
    };
  }

  function getBandLoveDisagreement(songId) {
    return _computeDisagreement(_bandLoveCache[songId] || 0, _personalBandLoveCache, songId);
  }

  function getAudienceLoveDisagreement(songId) {
    return _computeDisagreement(_audienceLoveCache[songId] || 0, _personalAudienceLoveCache, songId);
  }

  // Preload personal values from the same Firebase snapshot as shared values
  async function _preloadPersonalLove() {
    var db = _db(); if (!db) return;
    try {
      var snap = await db.ref(_bp('songs')).once('value');
      var data = snap.val();
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        var title = key.replace(/_/g, ' ');
        var song = data[key];
        if (song.bandLove && song.bandLove.personal) {
          _personalBandLoveCache[title] = {};
          _personalBandLoveCache[key] = {};
          Object.keys(song.bandLove.personal).forEach(function(mk) {
            var ps = song.bandLove.personal[mk];
            if (ps && ps.score) {
              _personalBandLoveCache[title][mk] = ps.score;
              _personalBandLoveCache[key][mk] = ps.score;
            }
          });
        }
        if (song.audienceLove && song.audienceLove.personal) {
          _personalAudienceLoveCache[title] = {};
          _personalAudienceLoveCache[key] = {};
          Object.keys(song.audienceLove.personal).forEach(function(mk) {
            var ps = song.audienceLove.personal[mk];
            if (ps && ps.score) {
              _personalAudienceLoveCache[title][mk] = ps.score;
              _personalAudienceLoveCache[key][mk] = ps.score;
            }
          });
        }
      });
    } catch(e) {}
  }

  // Love preload: start as soon as possible, retry until songs data is available.
  // Previously delayed 8s — now polls every 2s starting at 2s.
  // P0.3 (2026-05-08): timer captured + cancel path so this stops on cleanup
  // instead of looping forever on failure.
  var _lovePreloadDone = false;
  var _lovePreloadStopped = false;
  var _lovePreloadTimer = null;
  function _tryLovePreload() {
    _lovePreloadTimer = null;
    if (_lovePreloadDone || _lovePreloadStopped) return;
    var _hasDB = (typeof firebaseDB !== 'undefined' && firebaseDB);
    var _hasSongs = (typeof allSongs !== 'undefined' && allSongs && allSongs.length > 0);
    if (!_hasDB || !_hasSongs) {
      _lovePreloadTimer = setTimeout(_tryLovePreload, 2000);
      return;
    }
    _lovePreloadDone = true;
    _preloadBandLove().then(function() {
      return _preloadAudienceLove();
    }).then(function() {
      if (typeof renderSongs === 'function') {
        try { renderSongs(); } catch(e2) {}
      }
      return _preloadPersonalLove();
    }).catch(function(e) {
      _lovePreloadDone = false;
      if (!_lovePreloadStopped) _lovePreloadTimer = setTimeout(_tryLovePreload, 3000);
    });
  }
  function _stopLovePreload() {
    _lovePreloadStopped = true;
    if (_lovePreloadTimer) { clearTimeout(_lovePreloadTimer); _lovePreloadTimer = null; }
  }

  // Wire to GLStore + own beforeunload for cleanup
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', _stopLovePreload);
    if (window.GLStore) {
      var GL = window.GLStore;
      GL.saveBandLove                = saveBandLove;
      GL.getBandLove                 = getBandLove;
      GL.getAllBandLove              = getAllBandLove;
      GL.saveAudienceLove            = saveAudienceLove;
      GL.getAudienceLove             = getAudienceLove;
      GL.getAllAudienceLove          = getAllAudienceLove;
      GL.savePersonalBandLove        = savePersonalBandLove;
      GL.getPersonalBandLove         = getPersonalBandLove;
      GL.savePersonalAudienceLove    = savePersonalAudienceLove;
      GL.getPersonalAudienceLove     = getPersonalAudienceLove;
      GL.getBandLoveDisagreement     = getBandLoveDisagreement;
      GL.getAudienceLoveDisagreement = getAudienceLoveDisagreement;
      GL.deriveSongStatus            = deriveSongStatus;
    }
    _lovePreloadTimer = setTimeout(_tryLovePreload, 2000);
  }
})();
