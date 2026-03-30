// ============================================================================
// js/core/rehearsal-analysis-pipeline.js
// Post-rehearsal analysis pipeline: recording + notes → structured insights
//
// Entry point: RehearsalAnalysis.run(sessionId, opts)
// Trigger: called automatically after mixdown attach or session save
//
// Pipeline:
//   1. Load session data from Firebase
//   2. Parse notes into structured form (timestamps, issues, feedback)
//   3. If audio available, run segmentation via existing engines
//   4. Generate insights (deterministic + optional LLM enrichment)
//   5. Persist analysis to Firebase session record
//   6. Emit event for UI consumers
//
// DEPENDS ON: GLStore, RehearsalSegmentationEngine (optional), RehearsalStoryEngine (optional)
// ============================================================================

'use strict';

(function() {

  // ── Notes Parser ──────────────────────────────────────────────────────────

  /**
   * Parse raw rehearsal notes into structured data.
   * Extracts timestamps, song references, player mentions, issues, and positives.
   *
   * @param {string} notesText - Raw notes from the session
   * @param {string[]} knownSongs - List of known song titles for matching
   * @param {string[]} knownMembers - List of band member names for matching
   * @returns {object} Structured notes
   */
  function parseNotes(notesText, knownSongs, knownMembers) {
    if (!notesText || typeof notesText !== 'string') {
      return { timestamps: [], songRefs: [], playerRefs: [], issues: [], positives: [], raw: notesText || '' };
    }

    var lines = notesText.split(/\n/).map(function(l) { return l.trim(); }).filter(Boolean);
    var timestamps = [];
    var songRefs = [];
    var playerRefs = [];
    var issues = [];
    var positives = [];

    // Build lookup sets for matching
    var songSet = {};
    var songLower = {};
    (knownSongs || []).forEach(function(s) {
      songSet[s] = true;
      songLower[s.toLowerCase()] = s;
    });
    var memberSet = {};
    var memberLower = {};
    (knownMembers || []).forEach(function(m) {
      memberSet[m] = true;
      memberLower[m.toLowerCase()] = m;
      // Also match first names
      var first = m.split(/\s/)[0];
      if (first && first.length > 2) memberLower[first.toLowerCase()] = m;
    });

    // Timestamp patterns: "9:13", "9:13 - 9:48", "at 12:30", "[5:00]"
    var tsPattern = /\[?(\d{1,2}:\d{2})\]?\s*[-–—to]*\s*\[?(\d{1,2}:\d{2})?\]?/g;

    // Issue keywords
    var issueKeywords = /\b(wrong|missed|forgot|late|early|off|lost|sloppy|rushed|dragged|timing|pitch|key|sharp|flat|out of tune|needs work|fell apart|train ?wreck|crash|mess|rough|shaky|stumble|confused|unsure|weak|bad|problem|issue|fix|broken)\b/i;

    // Positive keywords
    var positiveKeywords = /\b(great|good|solid|tight|nailed|locked|perfect|smooth|clean|on fire|hot|killed it|crushed it|on point|improved|better|strong|nice|awesome|excellent|dialed|grooved|clicked|flowed)\b/i;

    lines.forEach(function(line) {
      var lineData = { text: line, songs: [], players: [], timestamp: null };

      // Extract timestamps
      var tsMatch;
      tsPattern.lastIndex = 0;
      while ((tsMatch = tsPattern.exec(line)) !== null) {
        var ts = { start: tsMatch[1] };
        if (tsMatch[2]) ts.end = tsMatch[2];
        ts.startSec = _parseTimestamp(tsMatch[1]);
        if (tsMatch[2]) ts.endSec = _parseTimestamp(tsMatch[2]);
        timestamps.push(ts);
        lineData.timestamp = ts;
      }

      // Match song titles (case-insensitive substring)
      var lineLower = line.toLowerCase();
      Object.keys(songLower).forEach(function(sl) {
        if (lineLower.indexOf(sl) !== -1) {
          var song = songLower[sl];
          if (lineData.songs.indexOf(song) === -1) lineData.songs.push(song);
          if (songRefs.indexOf(song) === -1) songRefs.push(song);
        }
      });

      // Match member names (word boundary to avoid "Tim" matching "Estimated" or "timing")
      Object.keys(memberLower).forEach(function(ml) {
        var memberRegex = new RegExp('\\b' + ml.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (memberRegex.test(line)) {
          var member = memberLower[ml];
          if (lineData.players.indexOf(member) === -1) lineData.players.push(member);
          if (playerRefs.indexOf(member) === -1) playerRefs.push(member);
        }
      });

      // Classify line as issue or positive
      if (issueKeywords.test(line)) {
        issues.push({
          text: line,
          songs: lineData.songs,
          players: lineData.players,
          timestamp: lineData.timestamp
        });
      }
      if (positiveKeywords.test(line)) {
        positives.push({
          text: line,
          songs: lineData.songs,
          players: lineData.players,
          timestamp: lineData.timestamp
        });
      }
    });

    return {
      timestamps: timestamps,
      songRefs: songRefs,
      playerRefs: playerRefs,
      issues: issues,
      positives: positives,
      raw: notesText
    };
  }

  /**
   * Parse "MM:SS" or "H:MM:SS" into seconds.
   */
  function _parseTimestamp(str) {
    if (!str) return 0;
    var parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  // ── Insight Generator ─────────────────────────────────────────────────────

  /**
   * Generate structured insights from parsed notes + optional segmentation.
   * Pure deterministic — no LLM calls.
   *
   * @param {object} params
   * @param {object} params.session - Firebase session record
   * @param {object} params.parsedNotes - Output of parseNotes()
   * @param {object} [params.story] - Output of RehearsalStoryEngine.buildStory()
   * @param {object} [params.v2Result] - Output of segmentAudioV2()
   * @returns {object} Insights
   */
  function generateInsights(params) {
    var session = params.session || {};
    var parsed = params.parsedNotes || {};
    var story = params.story || null;
    var v2Result = params.v2Result || null;

    var insights = {
      issues: [],
      playerFeedback: [],
      recommendations: [],
      improved: [],
      songBreakdown: []
    };

    // ── Per-song issues from notes ──
    var songIssueMap = {};
    (parsed.issues || []).forEach(function(iss) {
      (iss.songs || []).forEach(function(song) {
        if (!songIssueMap[song]) songIssueMap[song] = [];
        songIssueMap[song].push(iss.text);
      });
      if (!iss.songs || iss.songs.length === 0) {
        insights.issues.push({ song: null, text: iss.text, source: 'notes' });
      }
    });
    Object.keys(songIssueMap).forEach(function(song) {
      insights.issues.push({ song: song, text: songIssueMap[song].join('; '), source: 'notes', count: songIssueMap[song].length });
    });

    // ── Per-player feedback from notes ──
    var playerMap = {};
    (parsed.issues || []).concat(parsed.positives || []).forEach(function(item) {
      (item.players || []).forEach(function(player) {
        if (!playerMap[player]) playerMap[player] = { issues: [], positives: [] };
        if ((parsed.issues || []).indexOf(item) !== -1) playerMap[player].issues.push(item.text);
        if ((parsed.positives || []).indexOf(item) !== -1) playerMap[player].positives.push(item.text);
      });
    });
    Object.keys(playerMap).forEach(function(player) {
      insights.playerFeedback.push({
        player: player,
        issues: playerMap[player].issues,
        positives: playerMap[player].positives
      });
    });

    // ── Positives → improved ──
    (parsed.positives || []).forEach(function(pos) {
      insights.improved.push({ text: pos.text, songs: pos.songs || [] });
    });

    // ── Song breakdown from session blocks ──
    (session.blocks || []).forEach(function(block) {
      var breakdown = {
        title: block.title,
        budgetMin: block.budgetMin || 0,
        actualMin: block.actualMin || 0,
        issues: songIssueMap[block.title] || [],
        positives: []
      };
      // Match positives to songs
      (parsed.positives || []).forEach(function(pos) {
        if ((pos.songs || []).indexOf(block.title) !== -1) {
          breakdown.positives.push(pos.text);
        }
      });
      insights.songBreakdown.push(breakdown);
    });

    // ── Enrich from segmentation story ──
    if (story && story.coaching) {
      var coaching = story.coaching;
      if (coaching.mostRestarted) {
        insights.issues.push({
          song: coaching.mostRestarted,
          text: 'Most restarted song this session — needs focused run-throughs',
          source: 'segmentation'
        });
      }
      if (coaching.talkPercent > 30) {
        insights.recommendations.push('Talk time was ' + Math.round(coaching.talkPercent) + '% — try setting a 5-minute cap on discussions next rehearsal');
      }
    }

    // ── Generate actionable recommendations ──
    var issueSongs = {};
    insights.issues.forEach(function(iss) {
      if (iss.song) issueSongs[iss.song] = (issueSongs[iss.song] || 0) + (iss.count || 1);
    });

    // Sort songs by issue count descending
    var rankedIssueSongs = Object.keys(issueSongs).sort(function(a, b) { return issueSongs[b] - issueSongs[a]; });

    // Detect issue types from note text for specific recommendations
    var issueTypes = { timing: /timing|late|early|rushed|dragged|tempo|downbeat/i, key: /key|sharp|flat|pitch|tune/i, transition: /transition|segue|into|out of/i, lyrics: /lyric|forgot|words|verse|bridge/i, section: /intro|verse|chorus|bridge|solo|outro|ending|coda/i };

    rankedIssueSongs.forEach(function(song) {
      var songIssues = insights.issues.filter(function(i) { return i.song === song; });
      var allText = songIssues.map(function(i) { return i.text; }).join(' ');
      var count = issueSongs[song];
      var rec = '';

      // Detect what specifically went wrong
      var detected = [];
      Object.keys(issueTypes).forEach(function(type) {
        if (issueTypes[type].test(allText)) detected.push(type);
      });

      // Build specific recommendation
      if (detected.indexOf('transition') !== -1) {
        rec = 'Run the transition into/out of "' + song + '" 3 times at half tempo, then full speed';
      } else if (detected.indexOf('timing') !== -1) {
        rec = 'Practice "' + song + '" with a click track — ' + count + ' timing issue' + (count > 1 ? 's' : '') + ' flagged';
      } else if (detected.indexOf('key') !== -1) {
        rec = 'Check the key for "' + song + '" — pitch/key issues noted. Confirm all players are in the same key';
      } else if (detected.indexOf('lyrics') !== -1) {
        rec = 'Run "' + song + '" vocals-only or do a lyric read-through before next rehearsal';
      } else if (detected.indexOf('section') !== -1) {
        // Extract which section
        var sectionMatch = allText.match(/\b(intro|verse|chorus|bridge|solo|outro|ending|coda)\b/i);
        var sectionName = sectionMatch ? sectionMatch[1].toLowerCase() : 'the problem section';
        rec = 'Isolate the ' + sectionName + ' of "' + song + '" — run it ' + Math.max(3, count * 2) + ' times until locked';
      } else if (count >= 2) {
        rec = 'Dedicate a full block to "' + song + '" next rehearsal — ' + count + ' separate issues identified. Run it start to finish ' + Math.max(3, count) + ' times';
      } else {
        rec = 'Give "' + song + '" extra attention next rehearsal — run it twice, focusing on the flagged issue';
      }

      if (rec) insights.recommendations.push(rec);
    });

    // Segmentation-derived recommendations
    if (story && story.coaching) {
      if (story.coaching.talkPercent > 40) {
        insights.recommendations.push('Discussion took ' + Math.round(story.coaching.talkPercent) + '% of the session — set a 5-minute timer for talk breaks');
      } else if (story.coaching.talkPercent > 25) {
        insights.recommendations.push('Keep discussion under 20% next time (was ' + Math.round(story.coaching.talkPercent) + '%)');
      }
    }

    // Fallback: if no notes and no story, generate from session blocks
    if (insights.issues.length === 0 && insights.recommendations.length === 0) {
      var zeroBlocks = (session.blocks || []).filter(function(b) { return !b.actualMin || b.actualMin === 0; });
      if (zeroBlocks.length > 0 && (session.blocks || []).length > 0) {
        insights.recommendations.push(zeroBlocks.length + ' of ' + (session.blocks || []).length + ' songs had no recorded time — try using the timer during rehearsal');
      }
    }

    return insights;
  }

  // ── Pipeline Orchestrator ─────────────────────────────────────────────────

  /**
   * Run the full analysis pipeline for a rehearsal session.
   *
   * @param {string} sessionId - Firebase session ID (e.g., 'rsess_abc123')
   * @param {object} [opts]
   * @param {AudioBuffer} [opts.audioBuffer] - If audio is available for segmentation
   * @param {string} [opts.recordingUrl] - URL of the recording (for reference)
   * @returns {Promise<object>} Analysis result
   */
  async function run(sessionId, opts) {
    opts = opts || {};
    console.log('[RehearsalAnalysis] Starting pipeline for session:', sessionId, opts.force ? '(forced)' : '');

    // ── Step 0: Check for existing analysis (skip if force) ──
    if (!opts.force) {
      try {
        var existing = await loadAnalysis(sessionId);
        if (existing && existing.version) {
          console.log('[RehearsalAnalysis] Existing analysis found (v' + existing.version + '), skipping. Use force:true to reprocess.');
          _updateIssueIndex(existing);
          return { sessionId: sessionId, status: 'cached', analysis: existing };
        }
      } catch(e) { /* proceed with fresh analysis */ }
    }

    // ── Step 1: Load session data ──
    var session = null;
    try {
      var slug = (typeof GLStore !== 'undefined' && GLStore.getCurrentBand)
        ? GLStore.getCurrentBand() : (localStorage.getItem('deadcetera_current_band') || 'deadcetera');
      var ref = firebase.database().ref('bands/' + slug + '/rehearsal_sessions/' + sessionId);
      var snap = await ref.once('value');
      session = snap.val();
    } catch(e) {
      console.warn('[RehearsalAnalysis] Failed to load session:', e);
    }

    if (!session) {
      console.warn('[RehearsalAnalysis] No session data found for:', sessionId);
      return { sessionId: sessionId, status: 'no_session', analysis: null };
    }

    console.log('[RehearsalAnalysis] Session loaded — ' + (session.songsWorked || []).length + ' songs, ' +
      (session.notes ? session.notes.length + ' chars notes' : 'no notes'));

    // ── Step 2: Gather context ──
    var knownSongs = [];
    var knownMembers = [];
    try {
      if (typeof GLStore !== 'undefined') {
        knownSongs = (GLStore.getSongs() || []).map(function(s) { return s.title; });
        knownMembers = (GLStore.getBandMembers() || []).map(function(m) { return m.name || m; });
      }
    } catch(e) { /* non-critical */ }

    // ── Step 3: Parse notes ──
    var parsedNotes = parseNotes(session.notes || '', knownSongs, knownMembers);
    console.log('[RehearsalAnalysis] Notes parsed — ' + parsedNotes.issues.length + ' issues, ' +
      parsedNotes.positives.length + ' positives, ' + parsedNotes.songRefs.length + ' song refs');

    // ── Step 4: Run segmentation if audio available ──
    var v2Result = null;
    var story = null;
    if (opts.audioBuffer && typeof RehearsalSegmentationEngine !== 'undefined') {
      try {
        console.log('[RehearsalAnalysis] Running audio segmentation...');
        var features = {
          channelData: opts.audioBuffer.getChannelData(0),
          sampleRate: opts.audioBuffer.sampleRate,
          duration: opts.audioBuffer.duration
        };
        v2Result = RehearsalSegmentationEngine.segmentAudioV2(features, {
          annotations: parsedNotes.timestamps.map(function(ts) {
            return { time: ts.startSec, label: 'note', source: 'notes' };
          })
        });
        console.log('[RehearsalAnalysis] Segmentation complete — ' + (v2Result.events || []).length + ' events');
      } catch(e) {
        console.warn('[RehearsalAnalysis] Segmentation failed:', e);
      }
    }

    // ── Step 5: Build story from segmentation ──
    if (v2Result && typeof RehearsalStoryEngine !== 'undefined') {
      try {
        story = RehearsalStoryEngine.buildStory(v2Result, session.songsWorked || []);
        console.log('[RehearsalAnalysis] Story built — headline:', story.headline);
      } catch(e) {
        console.warn('[RehearsalAnalysis] Story engine failed:', e);
      }
    }

    // ── Step 6: Generate insights ──
    var insights = generateInsights({
      session: session,
      parsedNotes: parsedNotes,
      story: story,
      v2Result: v2Result
    });
    console.log('[RehearsalAnalysis] Insights generated — ' + insights.issues.length + ' issues, ' +
      insights.recommendations.length + ' recommendations');

    // ── Step 7: Build analysis result ──
    var analysis = {
      version: 1,
      analyzedAt: new Date().toISOString(),
      sessionId: sessionId,
      structuredNotes: parsedNotes,
      segments: v2Result ? v2Result.events : null,
      story: story ? {
        headline: story.headline,
        narrative: story.narrative,
        planVsActual: story.story ? story.story.planVsActual : null,
        highlights: story.story ? story.story.highlights : null
      } : null,
      insights: insights,
      sources: {
        hasNotes: !!(session.notes && session.notes.trim()),
        hasAudio: !!opts.audioBuffer,
        hasBlocks: !!(session.blocks && session.blocks.length),
        hasRecording: !!opts.recordingUrl
      }
    };

    // ── Step 7b: Mark timing source ──
    if (!v2Result && session.blocks) {
      analysis.timingSource = 'block_estimates';
      analysis.timingNote = 'Timing from session blocks (no audio segmentation)';
    } else if (v2Result) {
      analysis.timingSource = 'audio_segmentation';
      analysis.timingNote = null;
    } else {
      analysis.timingSource = 'none';
      analysis.timingNote = 'No timing data available';
    }

    // ── Step 8: Persist to Firebase ──
    try {
      var slug2 = (typeof GLStore !== 'undefined' && GLStore.getCurrentBand)
        ? GLStore.getCurrentBand() : (localStorage.getItem('deadcetera_current_band') || 'deadcetera');
      await firebase.database().ref('bands/' + slug2 + '/rehearsal_sessions/' + sessionId + '/analysis').set(analysis);
      console.log('[RehearsalAnalysis] Analysis persisted to Firebase');
    } catch(e) {
      console.warn('[RehearsalAnalysis] Failed to persist analysis:', e);
    }

    // ── Step 9: Update issue index for feedback loop ──
    _updateIssueIndex(analysis);

    // ── Step 10: Invalidate focus cache (issues may change priorities) ──
    if (typeof GLStore !== 'undefined' && GLStore.invalidateFocusCache) {
      GLStore.invalidateFocusCache();
    }

    // ── Step 11: Emit event ──
    if (typeof GLStore !== 'undefined' && GLStore.emit) {
      GLStore.emit('rehearsalAnalysisComplete', { sessionId: sessionId, analysis: analysis });
    }

    console.log('[RehearsalAnalysis] Pipeline complete for session:', sessionId);
    return { sessionId: sessionId, status: 'complete', analysis: analysis };
  }

  /**
   * Load persisted analysis for a session (from Firebase).
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async function loadAnalysis(sessionId) {
    try {
      var slug = (typeof GLStore !== 'undefined' && GLStore.getCurrentBand)
        ? GLStore.getCurrentBand() : (localStorage.getItem('deadcetera_current_band') || 'deadcetera');
      var snap = await firebase.database().ref('bands/' + slug + '/rehearsal_sessions/' + sessionId + '/analysis').once('value');
      return snap.val();
    } catch(e) {
      console.warn('[RehearsalAnalysis] Failed to load analysis:', e);
      return null;
    }
  }

  // ── Issue Signal Index ─────────────────────────────────────────────────
  // Aggregates issue counts from the latest session analysis for use by
  // getNowFocus(), rehearsal agenda, and practice recommendations.
  // Cached in localStorage for cross-page access.

  var _issueIndex = null;
  var _issueIndexTime = 0;
  var ISSUE_INDEX_TTL = 60000; // 1 minute cache

  /**
   * Get per-song issue counts from the most recent session analysis.
   * Returns { songTitle: { count, types, lastSession } }
   */
  function getIssueIndex() {
    if (_issueIndex && (Date.now() - _issueIndexTime < ISSUE_INDEX_TTL)) return _issueIndex;

    // Try localStorage first (fast, cross-page)
    try {
      var cached = localStorage.getItem('gl_rehearsal_issue_index');
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ts && (Date.now() - parsed.ts < 300000)) { // 5 min from localStorage
          _issueIndex = parsed.index;
          _issueIndexTime = Date.now();
          return _issueIndex;
        }
      }
    } catch(e) {}

    return _issueIndex || {};
  }

  /**
   * Build issue index from a completed analysis and persist.
   * Called automatically at end of run().
   */
  function _updateIssueIndex(analysis) {
    if (!analysis || !analysis.insights || !analysis.insights.issues) return;

    var index = {};
    analysis.insights.issues.forEach(function(iss) {
      if (!iss.song) return;
      if (!index[iss.song]) index[iss.song] = { count: 0, types: [], lastSession: analysis.sessionId };
      index[iss.song].count += (iss.count || 1);
      // Detect issue types
      var text = iss.text || '';
      if (/timing|late|early|rushed|dragged|tempo/i.test(text)) index[iss.song].types.push('timing');
      if (/key|sharp|flat|pitch|tune/i.test(text)) index[iss.song].types.push('pitch');
      if (/transition|segue/i.test(text)) index[iss.song].types.push('transition');
      if (/lyric|forgot.*word|forgot.*lyric/i.test(text)) index[iss.song].types.push('lyrics');
      if (/restart|fell apart|crash/i.test(text)) index[iss.song].types.push('stability');
      // Dedupe types
      index[iss.song].types = index[iss.song].types.filter(function(v, i, a) { return a.indexOf(v) === i; });
    });

    _issueIndex = index;
    _issueIndexTime = Date.now();

    // Persist to localStorage for cross-page access
    try {
      localStorage.setItem('gl_rehearsal_issue_index', JSON.stringify({ ts: Date.now(), index: index }));
    } catch(e) {}

    console.log('[RehearsalAnalysis] Issue index updated — ' + Object.keys(index).length + ' songs with issues');
  }

  /**
   * Get the focus score boost for a song based on rehearsal issues.
   * Returns 0-4 (higher = more issues = needs more focus).
   */
  function getIssueFocusBoost(songTitle) {
    var index = getIssueIndex();
    var entry = index[songTitle];
    if (!entry) return 0;
    // 1 issue = +1, 2 issues = +2, 3+ = +3, stability issues = +1 extra
    var boost = Math.min(entry.count, 3);
    if (entry.types && entry.types.indexOf('stability') !== -1) boost += 1;
    return Math.min(boost, 4);
  }

  /**
   * Get targeted practice blocks for songs with issues.
   * Returns array of { song, block, reason, runCount } for agenda injection.
   */
  function getTargetedPracticeBlocks() {
    var index = getIssueIndex();
    var blocks = [];

    Object.keys(index).forEach(function(song) {
      var entry = index[song];
      if (entry.count === 0) return;

      var block = { song: song, reason: '', runCount: 2, types: entry.types || [] };

      if (entry.types.indexOf('transition') !== -1) {
        block.reason = 'Transition issues — run at half tempo then full';
        block.runCount = 3;
      } else if (entry.types.indexOf('timing') !== -1) {
        block.reason = 'Timing issues — practice with click track';
        block.runCount = 3;
      } else if (entry.types.indexOf('stability') !== -1) {
        block.reason = 'Fell apart last time — run start to finish';
        block.runCount = Math.max(3, entry.count);
      } else if (entry.types.indexOf('lyrics') !== -1) {
        block.reason = 'Lyric issues — do a read-through first';
        block.runCount = 2;
      } else {
        block.reason = entry.count + ' issue' + (entry.count > 1 ? 's' : '') + ' flagged last rehearsal';
        block.runCount = Math.max(2, entry.count);
      }

      blocks.push(block);
    });

    // Sort by issue count descending
    blocks.sort(function(a, b) {
      var ac = index[a.song] ? index[a.song].count : 0;
      var bc = index[b.song] ? index[b.song].count : 0;
      return bc - ac;
    });

    return blocks;
  }

  /**
   * Load the latest session analysis for the "last rehearsal" dashboard card.
   * Returns the analysis object or null.
   */
  async function getLatestAnalysis() {
    try {
      var slug = (typeof GLStore !== 'undefined' && GLStore.getCurrentBand)
        ? GLStore.getCurrentBand() : (localStorage.getItem('deadcetera_current_band') || 'deadcetera');
      var snap = await firebase.database().ref('bands/' + slug + '/rehearsal_sessions')
        .orderByChild('date').limitToLast(1).once('value');
      var sessions = snap.val();
      if (!sessions) return null;
      var keys = Object.keys(sessions);
      var latest = sessions[keys[0]];
      return latest && latest.analysis ? latest.analysis : null;
    } catch(e) {
      console.warn('[RehearsalAnalysis] Failed to load latest analysis:', e);
      return null;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  window.RehearsalAnalysis = {
    run: run,
    loadAnalysis: loadAnalysis,
    getLatestAnalysis: getLatestAnalysis,
    parseNotes: parseNotes,
    generateInsights: generateInsights,
    getIssueIndex: getIssueIndex,
    getIssueFocusBoost: getIssueFocusBoost,
    getTargetedPracticeBlocks: getTargetedPracticeBlocks
  };

  console.log('[RehearsalAnalysis] Pipeline loaded');

})();
