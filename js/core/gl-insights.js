// ============================================================================
// js/core/gl-insights.js
// Band Intelligence Engine — persistent issue tracking, explainability,
// action plans, and trend detection.
//
// Firebase paths:
//   bands/{slug}/intelligence/issues/{songTitle}
//   bands/{slug}/intelligence/sessions/{sessionId}
//
// Public API: window.GLInsights
// ============================================================================

'use strict';

(function() {

  var _cache = {};       // In-memory issue cache { songTitle: data }
  var _cacheTime = 0;
  var CACHE_TTL = 30000; // 30s

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _getBandSlug() {
    if (typeof GLStore !== 'undefined' && GLStore.getCurrentBand) return GLStore.getCurrentBand();
    return localStorage.getItem('deadcetera_current_band') || 'deadcetera';
  }

  function _ref(path) {
    return firebase.database().ref('bands/' + _getBandSlug() + '/intelligence/' + path);
  }

  // ── Phase 1: Persistent Issue Store ───────────────────────────────────────

  /**
   * Record issues from a completed analysis into the persistent store.
   * Aggregates across sessions — does not replace, only accumulates.
   *
   * @param {object} analysis — output of RehearsalAnalysis.run()
   */
  async function recordSessionIssues(analysis) {
    if (!analysis || !analysis.insights || !analysis.sessionId) return;

    var sessionId = analysis.sessionId;
    var issues = analysis.insights.issues || [];
    var now = new Date().toISOString();

    // ── Write session snapshot ──
    try {
      await _ref('sessions/' + sessionId).set({
        analyzedAt: analysis.analyzedAt || now,
        issueCount: issues.filter(function(i) { return i.song; }).length,
        songs: (issues.filter(function(i) { return i.song; }).map(function(i) { return i.song; }))
          .filter(function(v, i, a) { return a.indexOf(v) === i; }),
        createdAt: now
      });
    } catch(e) {
      console.warn('[GLInsights] Session snapshot write failed:', e);
    }

    // ── Aggregate per-song issues ──
    var songMap = {};
    issues.forEach(function(iss) {
      if (!iss.song) return;
      if (!songMap[iss.song]) songMap[iss.song] = { count: 0, types: {} };
      songMap[iss.song].count += (iss.count || 1);

      // Classify types from text
      var text = iss.text || '';
      var typeChecks = {
        timing: /timing|late|early|rushed|dragged|tempo|downbeat/i,
        pitch: /key|sharp|flat|pitch|tune/i,
        transition: /transition|segue|into.*out of/i,
        lyrics: /lyric|forgot.*word|forgot.*lyric|forgot.*bridge/i,
        stability: /restart|fell apart|crash|train.*wreck|lost/i,
        section: /intro|verse|chorus|bridge|solo|outro|ending/i
      };
      Object.keys(typeChecks).forEach(function(type) {
        if (typeChecks[type].test(text)) {
          songMap[iss.song].types[type] = (songMap[iss.song].types[type] || 0) + 1;
        }
      });
    });

    // ── Merge into Firebase per-song records ──
    var updates = {};
    var songKeys = Object.keys(songMap);

    for (var i = 0; i < songKeys.length; i++) {
      var song = songKeys[i];
      var safeKey = _sanitizeKey(song);
      var current = null;

      try {
        var snap = await _ref('issues/' + safeKey).once('value');
        current = snap.val();
      } catch(e) { /* new entry */ }

      var existing = current || { totalCount: 0, recentCount: 0, types: {}, sessions: [], lastSeenAt: null, title: song };
      existing.totalCount += songMap[song].count;
      existing.lastSeenAt = now;
      existing.title = song; // ensure title is stored

      // Merge type counts
      Object.keys(songMap[song].types).forEach(function(type) {
        existing.types[type] = (existing.types[type] || 0) + songMap[song].types[type];
      });

      // Add session to history (keep last 10)
      if (existing.sessions.indexOf(sessionId) === -1) {
        existing.sessions.push(sessionId);
        if (existing.sessions.length > 10) existing.sessions = existing.sessions.slice(-10);
      }

      // Compute recentCount (last 3 sessions)
      // We'll recalculate this from actual session data below
      existing.recentCount = songMap[song].count; // current session contribution

      updates[safeKey] = existing;
    }

    // Write all updates
    try {
      var batch = {};
      Object.keys(updates).forEach(function(key) {
        batch[key] = updates[key];
      });
      await _ref('issues').update(batch);
      console.log('[GLInsights] Persisted issues for ' + songKeys.length + ' songs');
    } catch(e) {
      console.warn('[GLInsights] Issue persistence failed:', e);
    }

    // Invalidate cache
    _cache = {};
    _cacheTime = 0;
  }

  /**
   * Load all persistent issue data.
   * @returns {Promise<object>} { songTitle: { totalCount, recentCount, types, sessions, lastSeenAt } }
   */
  async function loadIssues() {
    if (_cacheTime && (Date.now() - _cacheTime < CACHE_TTL) && Object.keys(_cache).length) {
      return _cache;
    }

    try {
      var snap = await _ref('issues').once('value');
      var raw = snap.val() || {};
      var result = {};
      Object.keys(raw).forEach(function(key) {
        var entry = raw[key];
        if (entry && entry.title) result[entry.title] = entry;
      });
      _cache = result;
      _cacheTime = Date.now();

      // Also update localStorage for RehearsalAnalysis compatibility
      var lsIndex = {};
      Object.keys(result).forEach(function(title) {
        var e = result[title];
        lsIndex[title] = {
          count: e.totalCount,
          types: Object.keys(e.types || {}),
          lastSession: e.sessions && e.sessions.length ? e.sessions[e.sessions.length - 1] : null
        };
      });
      try {
        localStorage.setItem('gl_rehearsal_issue_index', JSON.stringify({ ts: Date.now(), index: lsIndex }));
      } catch(err) {}

      return result;
    } catch(e) {
      console.warn('[GLInsights] Failed to load issues:', e);
      return _cache || {};
    }
  }

  function _sanitizeKey(str) {
    return (str || '').replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');
  }

  // ── Phase 2: Explainability ───────────────────────────────────────────────

  /**
   * Get a human-readable explanation of why a song is in the focus list.
   *
   * @param {string} songTitle
   * @returns {object} { reason, details: string[], score }
   */
  function getFocusExplanation(songTitle) {
    var details = [];
    var reason = '';
    var score = 0;

    // Readiness
    var avg = 0;
    if (typeof GLStore !== 'undefined' && GLStore.avgReadiness) {
      avg = GLStore.avgReadiness(songTitle);
    }
    if (avg > 0 && avg < 4) {
      details.push('Readiness score: ' + avg.toFixed(1) + '/5');
      score += (5 - avg) * 2;
    }

    // Setlist membership
    var inSetlist = false;
    if (typeof GLStore !== 'undefined' && GLStore.getSetlists) {
      var setlists = GLStore.getSetlists() || [];
      if (setlists.length) {
        (setlists[0].sets || []).forEach(function(set) {
          (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : (item.title || '');
            if (t === songTitle) inSetlist = true;
          });
        });
      }
    }
    if (inSetlist) {
      details.push('In upcoming setlist');
      score += 3;
    }

    // Rehearsal issues (from persistent store or localStorage fallback)
    var issueEntry = _cache[songTitle] || null;
    if (!issueEntry && typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex) {
      var lsIndex = RehearsalAnalysis.getIssueIndex();
      if (lsIndex[songTitle]) {
        issueEntry = { totalCount: lsIndex[songTitle].count, types: {}, recentCount: lsIndex[songTitle].count };
        (lsIndex[songTitle].types || []).forEach(function(t) { issueEntry.types[t] = 1; });
      }
    }
    if (issueEntry && issueEntry.totalCount > 0) {
      var typeNames = Object.keys(issueEntry.types || {});
      var issueDetail = issueEntry.totalCount + ' issue' + (issueEntry.totalCount > 1 ? 's' : '') + ' from rehearsal';
      if (typeNames.length) issueDetail += ' (' + typeNames.join(', ') + ')';
      details.push(issueDetail);
      score += Math.min(issueEntry.totalCount, 3);
    }

    // Band love priority
    if (typeof GLStore !== 'undefined' && GLStore.getSongPriority) {
      var pri = GLStore.getSongPriority(songTitle);
      if (pri > 3) {
        details.push('High priority song (band loves it but needs work)');
      }
    }

    // Generate reason summary
    if (issueEntry && issueEntry.totalCount >= 2) {
      reason = 'Struggled in recent rehearsals';
    } else if (issueEntry && issueEntry.totalCount === 1) {
      reason = 'Had an issue last rehearsal';
    } else if (avg > 0 && avg < 2.5) {
      reason = 'Low readiness — needs focused work';
    } else if (avg > 0 && avg < 3.5) {
      reason = 'Getting there but not locked';
    } else if (inSetlist) {
      reason = 'In the setlist — keep it tight';
    } else {
      reason = 'Could use some attention';
    }

    return { reason: reason, details: details, score: score };
  }

  // ── Phase 3: Action Engine ────────────────────────────────────────────────

  /**
   * Generate a detailed action plan for a song with issues.
   *
   * @param {string} songTitle
   * @param {object} [issueEntry] — from issue index
   * @returns {object} { song, problemType, recommendation, actionPlan: string[], estimatedTime }
   */
  function buildActionPlan(songTitle, issueEntry) {
    if (!issueEntry) {
      var issues = _cache[songTitle] || null;
      if (!issues && typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex) {
        var lsIdx = RehearsalAnalysis.getIssueIndex();
        if (lsIdx[songTitle]) {
          issues = { totalCount: lsIdx[songTitle].count, types: {} };
          (lsIdx[songTitle].types || []).forEach(function(t) { issues.types[t] = 1; });
        }
      }
      issueEntry = issues;
    }
    if (!issueEntry || !issueEntry.totalCount) return null;

    var types = Object.keys(issueEntry.types || {});
    var plan = { song: songTitle, problemType: '', recommendation: '', actionPlan: [], estimatedTime: 5 };

    // Prioritize: stability > transition > timing > pitch > lyrics > section
    if (types.indexOf('stability') !== -1) {
      plan.problemType = 'stability';
      plan.recommendation = 'Fell apart last time \u2014 let\u2019s get a clean run';
      plan.actionPlan = [
        'This one came off the rails last rehearsal \u2014 here\u2019s how to fix it:',
        'Talk through the arrangement first \u2014 make sure everyone knows where the tricky parts are',
        'Begin at half tempo and commit to playing all the way through, no matter what happens',
        'If it holds together, bring it up to full speed',
        'If it falls apart again, isolate the exact section that broke and loop it until it\u2019s muscle memory',
        'Lock this in and the whole set gets stronger.'
      ];
      plan.estimatedTime = 15;
    } else if (types.indexOf('transition') !== -1) {
      plan.problemType = 'transition';
      plan.recommendation = 'The transition dragged \u2014 tighten the handoff';
      plan.actionPlan = [
        'The handoff was messy last time \u2014 quick fix:',
        'Go straight to the transition \u2014 just the last 8 bars into the first 8 of the next section',
        'Loop it a few times at 70% until it feels automatic',
        'Then run the full song without stopping and see if the transition holds',
        'If it still drags, try counting in the new section together out loud',
        'This is a 10-minute fix. Once it clicks, the whole flow opens up.'
      ];
      plan.estimatedTime = 10;
    } else if (types.indexOf('timing') !== -1) {
      plan.problemType = 'timing';
      plan.recommendation = 'Timing drifted \u2014 get back in the pocket';
      plan.actionPlan = [
        'Timing was off last rehearsal \u2014 time to lock it in:',
        'Put the click on at the song\u2019s tempo',
        'Focus on the trouble section \u2014 play it 3x with the click, no fudging it',
        'Run the whole song with the click',
        'Then drop the click and see if the feel stays \u2014 that\u2019s the real test',
        'When the pocket is there without the click, you\u2019re gig-ready.'
      ];
      plan.estimatedTime = 12;
    } else if (types.indexOf('pitch') !== -1) {
      plan.problemType = 'pitch';
      plan.recommendation = 'Pitch was off \u2014 get everyone in the same key';
      plan.actionPlan = [
        'Key issues came up last time \u2014 let\u2019s sort it out:',
        'Confirm the key out loud \u2014 everyone say it before you play a note',
        'Play through the chord changes slowly together and listen for the blend',
        'If someone\u2019s in a different spot, fix it now before it becomes a habit',
        'Run the song once all the way through \u2014 it should sound like one instrument',
        'This is where great bands separate \u2014 everyone locked into the same key.'
      ];
      plan.estimatedTime = 10;
    } else if (types.indexOf('lyrics') !== -1) {
      plan.problemType = 'lyrics';
      plan.recommendation = 'Lyrics got lost \u2014 quick read-through';
      plan.actionPlan = [
        'The words got away from you last time \u2014 easy fix:',
        'Read the lyrics out loud together \u2014 just the words, no music, no pressure',
        'Sing it through once vocals-only \u2014 feel where the words land',
        'Then run it with the full band \u2014 the words should feel locked in',
        'Quick win \u2014 this should only take a few minutes.'
      ];
      plan.estimatedTime = 8;
    } else if (types.indexOf('section') !== -1) {
      plan.problemType = 'section';
      plan.recommendation = 'A section keeps breaking \u2014 isolate and drill it';
      plan.actionPlan = [
        'There\u2019s a specific section that keeps tripping you up:',
        'Figure out exactly which part it is \u2014 that\u2019s where you spend your time',
        'Loop just that section at a comfortable tempo until it feels solid',
        'Connect it to what comes before and after \u2014 the transitions matter',
        'Run the full song and don\u2019t stop, even if it\u2019s not perfect \u2014 build the confidence to push through',
        'You\u2019re close \u2014 don\u2019t let one section hold you back.'
      ];
      plan.estimatedTime = 10;
    } else {
      plan.problemType = 'general';
      plan.recommendation = 'Had issues last time \u2014 worth another pass';
      plan.actionPlan = [
        'Something was off last rehearsal \u2014 let\u2019s clean it up:',
        'Quick check-in \u2014 what felt off? Get specific',
        'Run it start to finish without stopping \u2014 focus on the weak spots but commit to finishing',
        'Run it again right away \u2014 the second pass is where it locks in',
        'If this clicks, you\u2019re in great shape for the next gig.'
      ];
      plan.estimatedTime = 8;
    }

    return plan;
  }

  /**
   * Get "Fix What Broke" agenda block — sorted action plans for the rehearsal planner.
   * @param {number} [limit] — max songs (default 3)
   * @returns {object[]} Array of action plans
   */
  function getFixBlock(limit) {
    limit = limit || 3;
    var index = _cache;
    if (!Object.keys(index).length && typeof RehearsalAnalysis !== 'undefined') {
      var lsIdx = RehearsalAnalysis.getIssueIndex();
      Object.keys(lsIdx).forEach(function(song) {
        index[song] = { totalCount: lsIdx[song].count, types: {}, title: song };
        (lsIdx[song].types || []).forEach(function(t) { index[song].types[t] = 1; });
      });
    }

    var songs = Object.keys(index).filter(function(s) { return index[s].totalCount > 0; });
    songs.sort(function(a, b) { return (index[b].totalCount || 0) - (index[a].totalCount || 0); });

    return songs.slice(0, limit).map(function(song) {
      return buildActionPlan(song, index[song]);
    }).filter(Boolean);
  }

  // ── Phase 4: Next Action ──────────────────────────────────────────────────

  /**
   * Get the most important action to take right now.
   * @returns {object|null} { headline, detail, song, cta }
   */
  function getNextAction() {
    var index = _cache;
    if (!Object.keys(index).length && typeof RehearsalAnalysis !== 'undefined') {
      var lsIdx = RehearsalAnalysis.getIssueIndex();
      Object.keys(lsIdx).forEach(function(song) {
        index[song] = { totalCount: lsIdx[song].count, types: {}, title: song };
        (lsIdx[song].types || []).forEach(function(t) { index[song].types[t] = 1; });
      });
    }

    // Find the highest-issue song
    var topSong = null;
    var topCount = 0;
    Object.keys(index).forEach(function(song) {
      if (index[song].totalCount > topCount) {
        topCount = index[song].totalCount;
        topSong = song;
      }
    });

    if (!topSong) return null;

    var plan = buildActionPlan(topSong, index[topSong]);
    if (!plan) return null;

    var typeLabel = { stability: 'fell apart', timing: 'timing issues', pitch: 'key/pitch issues', transition: 'transition issues', lyrics: 'lyric gaps', section: 'section work', general: 'issues' }[plan.problemType] || 'issues';

    return {
      headline: 'Fix "' + topSong + '" (' + topCount + ' ' + typeLabel + ' last rehearsal)',
      detail: plan.actionPlan[0], // first step as preview
      song: topSong,
      plan: plan,
      cta: plan.estimatedTime <= 10 ? 'Start Practice' : 'Build Rehearsal Plan'
    };
  }

  // ── Phase 5: Trend Detection ──────────────────────────────────────────────

  /**
   * Get the improvement trend for a song across sessions.
   * Reads from persistent store (requires ≥2 sessions).
   *
   * @param {string} songTitle
   * @returns {object|null} { trend: 'improving'|'flat'|'worsening', text, sessions }
   */
  async function getTrend(songTitle) {
    var safeKey = _sanitizeKey(songTitle);
    try {
      var snap = await _ref('issues/' + safeKey).once('value');
      var data = snap.val();
      if (!data || !data.sessions || data.sessions.length < 2) return null;

      // Load the last 3 session snapshots to compare
      var sessionIds = data.sessions.slice(-3);
      var sessionCounts = [];

      for (var i = 0; i < sessionIds.length; i++) {
        var sSnap = await _ref('sessions/' + sessionIds[i]).once('value');
        var sData = sSnap.val();
        if (sData) {
          var songIssueCount = (sData.songs || []).filter(function(s) { return s === songTitle; }).length;
          // If the song is in the session's song list, it had issues
          sessionCounts.push(songIssueCount > 0 ? 1 : 0);
        }
      }

      if (sessionCounts.length < 2) return null;

      // Simple trend: compare first half to second half
      var first = sessionCounts.slice(0, Math.ceil(sessionCounts.length / 2));
      var second = sessionCounts.slice(Math.ceil(sessionCounts.length / 2));
      var firstAvg = first.reduce(function(a, b) { return a + b; }, 0) / first.length;
      var secondAvg = second.reduce(function(a, b) { return a + b; }, 0) / second.length;

      var trend, text;
      var typeNames = Object.keys(data.types || {});
      var typeStr = typeNames.length ? ' (' + typeNames.join(', ') + ')' : '';

      if (secondAvg < firstAvg) {
        trend = 'improving';
        text = 'Improving \u2014 fewer issues in recent rehearsals' + typeStr;
      } else if (secondAvg > firstAvg) {
        trend = 'worsening';
        text = 'Getting worse \u2014 more issues recently' + typeStr;
      } else {
        trend = 'flat';
        text = 'Flat \u2014 same issues persisting' + typeStr;
      }

      return { trend: trend, text: text, sessions: sessionIds.length, totalIssues: data.totalCount };
    } catch(e) {
      console.warn('[GLInsights] Trend fetch failed for ' + songTitle + ':', e);
      return null;
    }
  }

  // ── Phase 7: Bulk Re-analysis ─────────────────────────────────────────────

  /**
   * Re-run analysis on all past sessions.
   * Non-blocking — reports progress via callback.
   *
   * @param {function} [onProgress] - called with { done, total, current }
   * @returns {Promise<{ processed, failed, skipped }>}
   */
  async function reanalyzeAll(onProgress) {
    if (typeof RehearsalAnalysis === 'undefined') return { processed: 0, failed: 0, skipped: 0 };

    var slug = _getBandSlug();
    var snap = await firebase.database().ref('bands/' + slug + '/rehearsal_sessions').once('value');
    var sessions = snap.val();
    if (!sessions) return { processed: 0, failed: 0, skipped: 0 };

    var ids = Object.keys(sessions);
    var results = { processed: 0, failed: 0, skipped: 0 };

    for (var i = 0; i < ids.length; i++) {
      if (onProgress) onProgress({ done: i, total: ids.length, current: ids[i] });

      try {
        var result = await RehearsalAnalysis.run(ids[i], { force: true });
        if (result.status === 'complete') {
          // Record in persistent store
          if (result.analysis) await recordSessionIssues(result.analysis);
          results.processed++;
        } else {
          results.skipped++;
        }
      } catch(e) {
        console.warn('[GLInsights] Reanalysis failed for ' + ids[i] + ':', e);
        results.failed++;
      }
    }

    console.log('[GLInsights] Bulk reanalysis complete:', results);
    return results;
  }

  // ── Init: Load on boot ────────────────────────────────────────────────────

  // Lazy-load persistent issues 5s after boot (non-blocking)
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(function() { loadIssues(); }, { timeout: 5000 });
  } else {
    setTimeout(function() { loadIssues(); }, 5000);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  window.GLInsights = {
    // Phase 1: Persistent store
    recordSessionIssues: recordSessionIssues,
    loadIssues: loadIssues,

    // Phase 2: Explainability
    getFocusExplanation: getFocusExplanation,

    // Phase 3: Action engine
    buildActionPlan: buildActionPlan,
    getFixBlock: getFixBlock,

    // Phase 4: Next action
    getNextAction: getNextAction,

    // Phase 5: Trends
    getTrend: getTrend,

    // Phase 7: Bulk
    reanalyzeAll: reanalyzeAll
  };

  console.log('[GLInsights] Band Intelligence Engine loaded');

})();
