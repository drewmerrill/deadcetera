// ── Rehearsal Agenda + Session + Scorecard + Practice Stats ──────────────────
//
// Four related layers extracted together because they share state and
// invalidation triggers:
//
//   1. Agenda generation     — turns current band state into a ranked plan
//   2. Active session        — mutable execution state with per-item status
//   3. Completion + scorecard — summaries + trend + weak-spot analysis
//   4. Per-song practice stats — counters updated when sessions complete
//
// All four persist to localStorage:
//   - 'glRehearsalAgenda'       — agenda + active session + history
//   - 'glSongPracticeStats'     — per-song lastPracticedAt / counters
//
// Cache invalidation:
//   _agendaCache invalidates on readinessChanged, songFieldUpdated.status,
//   and transitionIntelligenceChanged (the last replaces an inline reset
//   that used to live next to the transition-write path in the store).
//
// LOAD ORDER: must come after groovelinx_store.js (uses GLStore.emit /
// GLStore.on / GLStore.getAllReadiness / GLStore.getAllStatus / GLStore.getSongs /
// GLStore.getSelectedSong / GLStore.getSetlists / GLStore.getTransitionIntelligence /
// GLStore.getRehearsalIntelligence / GLStore.getAttemptIntelligence /
// GLStore.setLiveRehearsalSong). Engines (RehearsalAgendaEngine,
// RehearsalScorecardEngine, RehearsalAnalysis, SongIntelligence) are looked up
// via typeof at call time, so module loads cleanly even before they arrive.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 11) — ~730 lines.
// The store no longer owns _state.songPracticeStats; it lives module-private
// here. Helpers _members / _buildActivityIndex / _buildUpcomingSongs are
// re-defined locally rather than coupled to gl-intelligence.

(function() {
  'use strict';

  // ── Cross-module bridge ──
  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    if (typeof window !== 'undefined' && window.GLStore && window.GLStore.emit) {
      window.GLStore.emit(eventName, payload);
    }
  }

  // ── Local helpers (duplicated from gl-intelligence; small + pure) ──

  function _members() {
    return (typeof bandMembers !== 'undefined') ? bandMembers : {};
  }

  function _memberKeys() {
    var m = _members();
    return m ? Object.keys(m) : [];
  }

  function _buildActivityIndex() {
    var log = (typeof activityLogCache !== 'undefined' && Array.isArray(activityLogCache))
      ? activityLogCache : [];
    var index = {};
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      if (!entry.song || !entry.time) continue;
      if (!index[entry.song] || entry.time > index[entry.song]) {
        index[entry.song] = entry.time;
      }
    }
    return index;
  }

  function _buildUpcomingSongs() {
    var upcoming = {};
    var today = new Date().toISOString().slice(0, 10);
    var GL = _gl();

    var setlists = (GL && GL.getSetlists) ? GL.getSetlists() : [];
    for (var s = 0; s < setlists.length; s++) {
      var sl = setlists[s];
      if (!sl.date || sl.date < today) continue;
      var sets = sl.sets || [];
      for (var si = 0; si < sets.length; si++) {
        var songs = sets[si].songs || [];
        for (var so = 0; so < songs.length; so++) {
          var title = songs[so].title || songs[so];
          if (title && !upcoming[title]) upcoming[title] = 'setlist';
        }
      }
    }

    if (typeof window._riLastFocusSongs !== 'undefined' && Array.isArray(window._riLastFocusSongs)) {
      for (var r = 0; r < window._riLastFocusSongs.length; r++) {
        var rt = window._riLastFocusSongs[r].title || window._riLastFocusSongs[r];
        if (rt && !upcoming[rt]) upcoming[rt] = 'plan';
      }
    }

    return upcoming;
  }

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

  // ── Module state ──

  var _agendaCache = null;

  var _rehearsalAgenda = {
    latestGenerated: null,
    activeSession: null,
    latestCompletedSummary: null,
    completionHistory: [],
  };

  var _agendaIdCounter = 0;
  var _AGENDA_STORAGE_KEY = 'glRehearsalAgenda';

  var _songPracticeStats = {};
  var _SONG_STATS_KEY = 'glSongPracticeStats';

  // ── Persistence ──

  function _persistAgenda() {
    try {
      localStorage.setItem(_AGENDA_STORAGE_KEY, JSON.stringify(_rehearsalAgenda));
    } catch (e) { /* storage full or unavailable */ }
  }

  function _persistSongPracticeStats() {
    try { localStorage.setItem(_SONG_STATS_KEY, JSON.stringify(_songPracticeStats)); } catch(e) {}
  }

  // Hydrate agenda
  try {
    var _savedAgenda = localStorage.getItem(_AGENDA_STORAGE_KEY);
    if (_savedAgenda) {
      var _parsed = JSON.parse(_savedAgenda);
      if (_parsed && typeof _parsed === 'object') {
        if (_parsed.latestGenerated && _parsed.latestGenerated.items) {
          _rehearsalAgenda.latestGenerated = _parsed.latestGenerated;
        }
        if (_parsed.activeSession && _parsed.activeSession.items && _parsed.activeSession.sessionId) {
          if (_parsed.activeSession.status === 'active') {
            _rehearsalAgenda.activeSession = _parsed.activeSession;
          }
        }
        if (_parsed.latestCompletedSummary && _parsed.latestCompletedSummary.sessionId) {
          _rehearsalAgenda.latestCompletedSummary = _parsed.latestCompletedSummary;
        }
        if (Array.isArray(_parsed.completionHistory)) {
          _rehearsalAgenda.completionHistory = _parsed.completionHistory.slice(0, 25);
        }
      }
    }
  } catch (e) { /* malformed data */ }

  // Hydrate practice stats
  try {
    var _savedStats = localStorage.getItem(_SONG_STATS_KEY);
    if (_savedStats) {
      var _parsedStats = JSON.parse(_savedStats);
      if (_parsedStats && typeof _parsedStats === 'object') {
        _songPracticeStats = _parsedStats;
      }
    }
  } catch(e) {}

  function _genId(prefix) { return prefix + '_' + Date.now() + '_' + (++_agendaIdCounter); }

  // ── Agenda input builder ──

  function getRehearsalAgendaInput() {
    var GL = _gl(); if (!GL) return null;
    var allReadiness = GL.getAllReadiness();
    var allStatus = GL.getAllStatus();
    var songs = GL.getSongs();
    var activityIndex = _buildActivityIndex();
    var memberKeys = _memberKeys();

    // Build attention lookup by songId
    var attentionBySongId = {};
    var attentionList = (typeof SongIntelligence !== 'undefined')
      ? SongIntelligence.computePracticeAttention(
          allReadiness, allStatus, _members(), songs,
          activityIndex, _buildUpcomingSongs(), { limit: 200 }
        )
      : [];
    for (var i = 0; i < attentionList.length; i++) {
      attentionBySongId[attentionList[i].songId] = attentionList[i];
    }

    // Build transition intelligence for linked pairs
    var transitionsBySongPair = {};
    var ti = (GL.getTransitionIntelligence ? GL.getTransitionIntelligence() : {}) || {};
    Object.keys(ti).forEach(function(key) {
      var rec = ti[key];
      if (rec && rec.fromSongId && rec.toSongId) {
        transitionsBySongPair[key] = rec;
      }
    });

    // Detect linked pairs from setlists for songs that have no transition record yet
    try {
      var setlists = (GL.getSetlists ? GL.getSetlists() : []) || [];
      setlists.forEach(function(sl) {
        (sl.sets || []).forEach(function(set) {
          var setSongs = set.songs || [];
          for (var si = 0; si < setSongs.length - 1; si++) {
            var sg = setSongs[si];
            var segue = (typeof sg === 'object') ? (sg.segue || 'stop') : 'stop';
            if (segue === 'flow' || segue === 'segue') {
              var fromTitle = typeof sg === 'string' ? sg : (sg.title || '');
              var toSg = setSongs[si + 1];
              var toTitle = typeof toSg === 'string' ? toSg : (toSg.title || '');
              if (fromTitle && toTitle) {
                var pairKey = _makeTransitionKey(fromTitle, toTitle);
                if (!transitionsBySongPair[pairKey]) {
                  transitionsBySongPair[pairKey] = _getDefaultTransitionRecord(fromTitle, toTitle);
                }
              }
            }
          }
        });
      });
    } catch (e) {}

    return {
      songs: songs,
      readinessBySongId: allReadiness,
      attentionBySongId: attentionBySongId,
      recentActivityBySongId: activityIndex,
      practiceStatsBySongId: _songPracticeStats || {},
      weakSpotsBySongId: _buildWeakSpotIndex(),
      rehearsalSignalsBySongId: _buildRehearsalSignalIndex(),
      rehearsalSessionSignals: _buildRehearsalSessionSignals(),
      attemptSignalsBySongId: _buildAttemptSignalIndex(),
      transitionsBySongPair: transitionsBySongPair,
      targetedPracticeBlocks: (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getTargetedPracticeBlocks)
        ? RehearsalAnalysis.getTargetedPracticeBlocks() : [],
      issueIndex: (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex)
        ? RehearsalAnalysis.getIssueIndex() : {},
      memberKeys: memberKeys,
      currentSongId: GL.getSelectedSong ? GL.getSelectedSong() : null,
      nowPlayingSongId: GL.getNowPlaying ? GL.getNowPlaying() : null,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  function _buildWeakSpotIndex() {
    var ws = getRehearsalWeakSpots();
    if (!ws || !ws.hasEnoughData || !ws.songs.length) return {};
    var index = {};
    for (var i = 0; i < ws.songs.length; i++) {
      index[ws.songs[i].songId] = ws.songs[i];
    }
    return index;
  }

  function _buildRehearsalSignalIndex() {
    var GL = _gl();
    var ri = (GL && GL.getRehearsalIntelligence) ? GL.getRehearsalIntelligence() : null;
    if (!ri || !ri.hasData || !ri.songPasses || !ri.songPasses.length) return {};

    var index = {};
    for (var i = 0; i < ri.songPasses.length; i++) {
      var sp = ri.songPasses[i];
      var restartCount = sp.restarts ? sp.restarts.length : 0;
      var longestAttempt = 0;
      if (sp.attempts) {
        for (var a = 0; a < sp.attempts.length; a++) {
          if (sp.attempts[a].durationSec > longestAttempt) longestAttempt = sp.attempts[a].durationSec;
        }
      }
      index[sp.title] = {
        restartCount: restartCount,
        wasRestartHeavy: restartCount >= 3,
        hadCleanRun: longestAttempt >= 60,
        cleanRunSec: longestAttempt,
        totalWorkSec: sp.totalWorkSec || 0,
      };
    }
    return index;
  }

  function _buildRehearsalSessionSignals() {
    var GL = _gl();
    var ri = (GL && GL.getRehearsalIntelligence) ? GL.getRehearsalIntelligence() : null;
    if (!ri || !ri.hasData) return null;

    var musicPct = ri.totalDurationSec > 0 ? Math.round((ri.musicSec / ri.totalDurationSec) * 100) : 0;
    var speechPct = ri.totalDurationSec > 0 ? Math.round((ri.speechSec / ri.totalDurationSec) * 100) : 0;
    var silencePct = ri.totalDurationSec > 0 ? Math.round((ri.silenceSec / ri.totalDurationSec) * 100) : 0;

    var restartHeavySongCount = 0;
    var cleanRunSongCount = 0;
    if (ri.songPasses) {
      for (var i = 0; i < ri.songPasses.length; i++) {
        var sp = ri.songPasses[i];
        if (sp.restarts && sp.restarts.length >= 2) restartHeavySongCount++;
        if (sp.attempts) {
          for (var a = 0; a < sp.attempts.length; a++) {
            if (sp.attempts[a].durationSec >= 60) { cleanRunSongCount++; break; }
          }
        }
      }
    }

    return {
      lowMusicDensity: musicPct < 50,
      highRestartSession: ri.restartCount >= 4 || restartHeavySongCount >= 2,
      strongConfidenceSession: cleanRunSongCount >= 3 && ri.restartCount <= 1,
      lowMetadataCompleteness: ri.metadataCompleteness < 40,
      musicPct: musicPct,
      speechPct: speechPct,
      silencePct: silencePct,
      cleanRunSongCount: cleanRunSongCount,
      restartHeavySongCount: restartHeavySongCount,
      hasRecordingData: true,
    };
  }

  function _buildAttemptSignalIndex() {
    var GL = _gl();
    var ai = (GL && GL.getAttemptIntelligence) ? GL.getAttemptIntelligence() : null;
    if (!ai || !ai.hasData) return {};
    var index = {};
    for (var i = 0; i < ai.songs.length; i++) {
      var s = ai.songs[i];
      index[s.title] = {
        attemptCount: s.attemptCount,
        restartEndedCount: s.restartEndedCount,
        bestRunSec: s.bestRun ? s.bestRun.durationSec : 0,
        totalWorkSec: s.totalWorkSec,
        lowConfidence: s.lowConfidence,
        improving: s.improving,
      };
    }
    return index;
  }

  // ── Generation ──

  function generateRehearsalAgenda(options) {
    if (typeof RehearsalAgendaEngine === 'undefined') return null;
    if (!_agendaCache) {
      var input = getRehearsalAgendaInput();
      _agendaCache = RehearsalAgendaEngine.generateRehearsalAgenda(input, options);
      if (_agendaCache && !_agendaCache.empty) {
        _rehearsalAgenda.latestGenerated = _agendaCache;
        _persistAgenda();
      }
    }
    return _agendaCache;
  }

  function regenerateRehearsalAgenda(options) {
    var previousSongIds = null;
    if (_agendaCache && _agendaCache.items && _agendaCache.items.length) {
      previousSongIds = _agendaCache.items.map(function (i) { return i.songId; });
    }
    _agendaCache = null;
    if (typeof RehearsalAgendaEngine === 'undefined') return null;
    var input = getRehearsalAgendaInput();
    var opts = Object.assign({}, options || {}, { previousSongIds: previousSongIds });
    _agendaCache = RehearsalAgendaEngine.generateRehearsalAgenda(input, opts);
    if (_agendaCache && !_agendaCache.empty) {
      _rehearsalAgenda.latestGenerated = _agendaCache;
      _persistAgenda();
    }
    return _agendaCache;
  }

  // ── Session API ──

  function getLatestRehearsalAgenda() {
    return _rehearsalAgenda.latestGenerated;
  }

  function getActiveRehearsalAgendaSession() {
    return _rehearsalAgenda.activeSession;
  }

  function getCurrentRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    return s.items[s.currentIndex] || null;
  }

  function hasNextRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return false;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') return true;
    }
    return false;
  }

  function startRehearsalAgendaSession(options) {
    options = options || {};
    var GL = _gl();
    var gen = _rehearsalAgenda.latestGenerated || generateRehearsalAgenda();
    if (!gen || gen.empty || !gen.items.length) return null;

    _rehearsalAgenda.latestGenerated = gen;

    var startIdx = options.startIndex || 0;
    if (startIdx < 0 || startIdx >= gen.items.length) startIdx = 0;
    var now = new Date().toISOString();

    var sessionItems = gen.items.map(function (item, idx) {
      return {
        slot: item.slot,
        songId: item.songId,
        title: item.title,
        type: item.type,
        minutes: item.minutes,
        reason: item.reason,
        focus: item.focus,
        metadata: item.metadata,
        status: idx < startIdx ? 'done' : idx === startIdx ? 'live' : 'pending',
        enteredLiveAt: idx === startIdx ? now : null,
        completedAt: null,
      };
    });

    // Snapshot readiness for delta comparison
    var allReadiness = (GL && GL.getAllReadiness) ? GL.getAllReadiness() : {};
    var readinessSnapshot = {};
    for (var rs = 0; rs < gen.items.length; rs++) {
      var rsId = gen.items[rs].songId;
      var songR = allReadiness[rsId] || {};
      var vals = [];
      var keys = _memberKeys();
      for (var rk = 0; rk < keys.length; rk++) {
        var rv = songR[keys[rk]];
        if (rv && rv >= 1 && rv <= 5) vals.push(rv);
      }
      readinessSnapshot[rsId] = {
        scores: Object.assign({}, songR),
        avg: vals.length ? Math.round((vals.reduce(function(a,b){return a+b;},0) / vals.length) * 10) / 10 : null,
      };
    }

    var pocketAtStart = (typeof window._lastPocketScore !== 'undefined') ? window._lastPocketScore : null;

    _rehearsalAgenda.activeSession = {
      sessionId: _genId('ses'),
      agendaId: gen.generatedAt,
      startedAt: now,
      updatedAt: now,
      status: 'active',
      readinessSnapshot: readinessSnapshot,
      pocketAtStart: pocketAtStart,
      currentIndex: startIdx,
      startedFrom: startIdx,
      items: sessionItems,
    };

    try { localStorage.setItem('gl_last_practice_ts', now); } catch(e) {}

    var firstItem = sessionItems[startIdx];
    if (GL && GL.setLiveRehearsalSong) GL.setLiveRehearsalSong(firstItem.songId);
    _persistAgenda();
    _emit('agendaSessionStarted', { session: _rehearsalAgenda.activeSession, item: firstItem });

    var focusSongs = gen.items.map(function (i) { return { title: i.songId }; });
    if (typeof showPage === 'function') showPage('rehearsal');
    setTimeout(function () {
      if (typeof enterLiveRehearsalMode === 'function') {
        enterLiveRehearsalMode({ nextEvent: null }, focusSongs);
      }
    }, 200);

    return _rehearsalAgenda.activeSession;
  }

  function startRehearsalAgendaAtIndex(index) {
    return startRehearsalAgendaSession({ startIndex: index });
  }

  function advanceRehearsalAgendaSession() {
    return _transitionCurrentItem('done');
  }

  function skipCurrentRehearsalAgendaItem() {
    return _transitionCurrentItem('skipped');
  }

  function _transitionCurrentItem(endStatus) {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;

    var GL = _gl();
    var now = new Date().toISOString();
    var cur = s.items[s.currentIndex];
    if (cur) {
      cur.status = endStatus;
      cur.completedAt = now;
    }

    var nextIdx = -1;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') { nextIdx = i; break; }
    }

    if (nextIdx === -1) {
      completeRehearsalAgendaSession();
      return null;
    }

    s.currentIndex = nextIdx;
    s.updatedAt = now;
    var nextItem = s.items[nextIdx];
    nextItem.status = 'live';
    nextItem.enteredLiveAt = now;

    if (GL && GL.setLiveRehearsalSong) GL.setLiveRehearsalSong(nextItem.songId);
    _persistAgenda();
    _emit('agendaSlotAdvanced', { session: s, index: nextIdx, item: nextItem });
    return nextItem;
  }

  function setCurrentRehearsalAgendaIndex(index) {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    if (index < 0 || index >= s.items.length) return null;

    var GL = _gl();
    var now = new Date().toISOString();
    var cur = s.items[s.currentIndex];
    if (cur && cur.status === 'live') { cur.status = 'done'; cur.completedAt = now; }

    s.currentIndex = index;
    s.updatedAt = now;
    var target = s.items[index];
    target.status = 'live';
    target.enteredLiveAt = now;

    if (GL && GL.setLiveRehearsalSong) GL.setLiveRehearsalSong(target.songId);
    _persistAgenda();
    _emit('agendaSlotAdvanced', { session: s, index: index, item: target });
    return target;
  }

  function completeRehearsalAgendaSession() {
    var s = _rehearsalAgenda.activeSession;
    if (!s) return;
    var GL = _gl();
    s.status = 'completed';
    s.updatedAt = new Date().toISOString();
    if (GL && GL.setLiveRehearsalSong) GL.setLiveRehearsalSong(null);

    var currentReadiness = {};
    var allR = (GL && GL.getAllReadiness) ? GL.getAllReadiness() : {};
    var mKeys = _memberKeys();
    for (var cr = 0; cr < s.items.length; cr++) {
      var crId = s.items[cr].songId;
      var crScores = allR[crId] || {};
      var crVals = [];
      for (var ck = 0; ck < mKeys.length; ck++) {
        var cv = crScores[mKeys[ck]];
        if (cv && cv >= 1 && cv <= 5) crVals.push(cv);
      }
      currentReadiness[crId] = {
        scores: Object.assign({}, crScores),
        avg: crVals.length ? Math.round((crVals.reduce(function(a,b){return a+b;},0) / crVals.length) * 10) / 10 : null,
      };
    }

    var pocketAtEnd = (typeof window._lastPocketScore !== 'undefined') ? window._lastPocketScore : null;

    var enrichment = {
      readinessBefore: s.readinessSnapshot || {},
      readinessAfter: currentReadiness,
      pocketBefore: s.pocketAtStart || null,
      pocketAfter: pocketAtEnd,
      completionHistory: _rehearsalAgenda.completionHistory || [],
    };

    if (typeof RehearsalScorecardEngine !== 'undefined' && RehearsalScorecardEngine.generateScorecard) {
      _rehearsalAgenda.latestCompletedSummary = RehearsalScorecardEngine.generateScorecard(s, enrichment);
    } else {
      _rehearsalAgenda.latestCompletedSummary = _buildCompletionSummary(s);
    }

    _applyCompletionSummaryToSongStats(_rehearsalAgenda.latestCompletedSummary);

    if (!_rehearsalAgenda.completionHistory) _rehearsalAgenda.completionHistory = [];
    _rehearsalAgenda.completionHistory.unshift(_rehearsalAgenda.latestCompletedSummary);
    if (_rehearsalAgenda.completionHistory.length > 25) {
      _rehearsalAgenda.completionHistory = _rehearsalAgenda.completionHistory.slice(0, 25);
    }

    _persistAgenda();
    _emit('agendaSessionCompleted', { session: s, summary: _rehearsalAgenda.latestCompletedSummary });
  }

  function _buildCompletionSummary(session) {
    var completed = [];
    var skipped = [];
    var completedMinutes = 0;
    var skippedMinutes = 0;

    for (var i = 0; i < session.items.length; i++) {
      var item = session.items[i];
      if (item.status === 'done') {
        completed.push({ songId: item.songId, title: item.title, type: item.type, minutes: item.minutes });
        completedMinutes += item.minutes;
      } else if (item.status === 'skipped') {
        skipped.push({ songId: item.songId, title: item.title, type: item.type, minutes: item.minutes });
        skippedMinutes += item.minutes;
      }
    }

    var totalPlanned = completedMinutes + skippedMinutes;
    var completionRate = totalPlanned > 0 ? Math.round((completedMinutes / totalPlanned) * 100) : 0;

    var durationMs = 0;
    if (session.startedAt && session.updatedAt) {
      durationMs = new Date(session.updatedAt).getTime() - new Date(session.startedAt).getTime();
    }
    var durationElapsedMinutes = Math.round(durationMs / 60000);

    var coverageRatio = session.items.length > 0 ? completed.length / session.items.length : 0;
    var score = Math.round(completionRate * 0.6 + coverageRatio * 100 * 0.4);

    return {
      sessionId: session.sessionId,
      completedAt: session.updatedAt,
      startedAt: session.startedAt,
      totalItems: session.items.length,
      completedCount: completed.length,
      skippedCount: skipped.length,
      completedMinutes: completedMinutes,
      skippedMinutes: skippedMinutes,
      totalPlannedMinutes: totalPlanned,
      minutesAttempted: completedMinutes,
      durationElapsedMinutes: durationElapsedMinutes,
      completionRate: completionRate,
      score: score,
      completedSongs: completed,
      skippedSongs: skipped,
    };
  }

  // ── Scorecard / history / weak spots ──

  function getLatestCompletedSummary() {
    return _rehearsalAgenda.latestCompletedSummary || null;
  }

  function getCompletionHistory() {
    return _rehearsalAgenda.completionHistory || [];
  }

  function getRehearsalWeakSpots() {
    if (typeof RehearsalScorecardEngine === 'undefined' || !RehearsalScorecardEngine.analyzeWeakSpots) return null;
    return RehearsalScorecardEngine.analyzeWeakSpots(_rehearsalAgenda.completionHistory || []);
  }

  function getRehearsalScorecardData() {
    var latest = _rehearsalAgenda.latestCompletedSummary;
    if (!latest) return null;

    var trend = getRecentRehearsalTrendSummary();

    return {
      latest: latest,
      trend: trend,
    };
  }

  function getRecentRehearsalTrendSummary() {
    var history = _rehearsalAgenda.completionHistory || [];
    if (!history.length) return null;

    var recent = history.slice(0, 5);
    var totalScore = 0;
    var totalRate = 0;
    var totalMins = 0;
    var totalElapsed = 0;
    var totalCompleted = 0;
    var totalSkipped = 0;

    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      totalScore += (s.score || 0);
      totalRate += (s.completionRate || 0);
      var ti = s.trendInputs || s;
      totalMins += (ti.completedMinutes || 0);
      var _elapsed = ti.elapsedMinutes || s.durationElapsedMinutes || 0;
      if (_elapsed >= 3) totalElapsed += _elapsed;
      totalCompleted += (ti.completedCount || 0);
      totalSkipped += (ti.skippedCount || 0);
    }

    var count = recent.length;
    return {
      sessionCount: count,
      avgScore: Math.round(totalScore / count),
      avgCompletionRate: Math.round(totalRate / count),
      totalCompletedMinutes: totalMins,
      totalElapsedMinutes: totalElapsed,
      totalSongsCompleted: totalCompleted,
      totalSongsSkipped: totalSkipped,
      oldestSessionAt: recent[count - 1].completedAt || null,
      newestSessionAt: recent[0].completedAt || null,
    };
  }

  // ── Per-song practice stats ──

  function _applyCompletionSummaryToSongStats(summary) {
    if (!summary || !summary.completedSongs || !summary.completedSongs.length) return;
    var ts = summary.completedAt || new Date().toISOString();

    for (var i = 0; i < summary.completedSongs.length; i++) {
      var song = summary.completedSongs[i];
      var id = song.songId;
      if (!id) continue;

      if (!_songPracticeStats[id]) {
        _songPracticeStats[id] = {
          lastPracticedAt: null,
          practiceCount: 0,
          totalPracticeMinutes: 0,
          lastPracticeType: null,
        };
      }
      var stat = _songPracticeStats[id];
      stat.lastPracticedAt = ts;
      stat.practiceCount = (stat.practiceCount || 0) + 1;
      stat.totalPracticeMinutes = (stat.totalPracticeMinutes || 0) + (song.minutes || 0);
      if (song.type) stat.lastPracticeType = song.type;
    }

    _persistSongPracticeStats();
  }

  function getSongPracticeStats(songId) {
    return _songPracticeStats[songId] || null;
  }

  function getAllSongPracticeStats() {
    return _songPracticeStats;
  }

  // ── Abandon / next-preview / aliases ──

  function abandonRehearsalAgendaSession() {
    var s = _rehearsalAgenda.activeSession;
    if (!s) return;
    var GL = _gl();
    s.status = 'abandoned';
    s.updatedAt = new Date().toISOString();
    if (GL && GL.setLiveRehearsalSong) GL.setLiveRehearsalSong(null);
    _persistAgenda();
    _emit('agendaSessionAbandoned', { session: s });
  }

  function getNextRehearsalAgendaItem() {
    var s = _rehearsalAgenda.activeSession;
    if (!s || s.status !== 'active') return null;
    for (var i = s.currentIndex + 1; i < s.items.length; i++) {
      if (s.items[i].status === 'pending') return s.items[i];
    }
    return null;
  }

  function startRehearsalFromAgenda() { return startRehearsalAgendaSession(); }
  function clearRehearsalAgenda() { abandonRehearsalAgendaSession(); }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;

    if (GL.on) {
      GL.on('readinessChanged', function () { _agendaCache = null; });
      GL.on('songFieldUpdated', function (e) {
        if (e && e.field === 'status') _agendaCache = null;
      });
      // Replaces inline _agendaCache reset that lived in store next to
      // upsertTransitionIntelligence; the store now emits this event there.
      GL.on('transitionIntelligenceChanged', function () { _agendaCache = null; });
    }

    GL.getRehearsalAgendaInput         = getRehearsalAgendaInput;
    GL.generateRehearsalAgenda         = generateRehearsalAgenda;
    GL.regenerateRehearsalAgenda       = regenerateRehearsalAgenda;
    GL.startRehearsalFromAgenda        = startRehearsalFromAgenda;
    GL.startRehearsalAgendaSession     = startRehearsalAgendaSession;
    GL.startRehearsalAgendaAtIndex     = startRehearsalAgendaAtIndex;
    GL.advanceRehearsalAgendaSession   = advanceRehearsalAgendaSession;
    GL.skipCurrentRehearsalAgendaItem  = skipCurrentRehearsalAgendaItem;
    GL.setCurrentRehearsalAgendaIndex  = setCurrentRehearsalAgendaIndex;
    GL.completeRehearsalAgendaSession  = completeRehearsalAgendaSession;
    GL.abandonRehearsalAgendaSession   = abandonRehearsalAgendaSession;
    GL.getLatestRehearsalAgenda        = getLatestRehearsalAgenda;
    GL.getActiveRehearsalAgendaSession = getActiveRehearsalAgendaSession;
    GL.getCurrentRehearsalAgendaItem   = getCurrentRehearsalAgendaItem;
    GL.hasNextRehearsalAgendaItem      = hasNextRehearsalAgendaItem;
    GL.getNextRehearsalAgendaItem      = getNextRehearsalAgendaItem;
    GL.getLatestCompletedSummary       = getLatestCompletedSummary;
    GL.getCompletionHistory            = getCompletionHistory;
    GL.getRehearsalScorecardData       = getRehearsalScorecardData;
    GL.getRehearsalScorecardHistory    = getCompletionHistory; // alias
    GL.getRehearsalWeakSpots           = getRehearsalWeakSpots;
    GL.getRecentRehearsalTrendSummary  = getRecentRehearsalTrendSummary;
    GL.getSongPracticeStats            = getSongPracticeStats;
    GL.getAllSongPracticeStats         = getAllSongPracticeStats;
    GL.clearRehearsalAgenda            = clearRehearsalAgenda;
  }
})();
