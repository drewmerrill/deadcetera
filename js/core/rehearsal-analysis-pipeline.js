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

    // ── Generate recommendations ──
    if (insights.issues.length > 0 && insights.recommendations.length === 0) {
      // Find the most-mentioned problem song
      var issueSongs = {};
      insights.issues.forEach(function(iss) {
        if (iss.song) issueSongs[iss.song] = (issueSongs[iss.song] || 0) + 1;
      });
      var topIssueSong = null;
      var topCount = 0;
      Object.keys(issueSongs).forEach(function(s) {
        if (issueSongs[s] > topCount) { topCount = issueSongs[s]; topIssueSong = s; }
      });
      if (topIssueSong) {
        insights.recommendations.push('Focus next rehearsal on "' + topIssueSong + '" — it had the most issues (' + topCount + ')');
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
    console.log('[RehearsalAnalysis] Starting pipeline for session:', sessionId);

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

    // ── Step 8: Persist to Firebase ──
    try {
      var slug = (typeof GLStore !== 'undefined' && GLStore.getCurrentBand)
        ? GLStore.getCurrentBand() : (localStorage.getItem('deadcetera_current_band') || 'deadcetera');
      await firebase.database().ref('bands/' + slug + '/rehearsal_sessions/' + sessionId + '/analysis').set(analysis);
      console.log('[RehearsalAnalysis] Analysis persisted to Firebase');
    } catch(e) {
      console.warn('[RehearsalAnalysis] Failed to persist analysis:', e);
      // Non-fatal — analysis still returned in-memory
    }

    // ── Step 9: Emit event ──
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

  // ── Public API ──────────────────────────────────────────────────────────

  window.RehearsalAnalysis = {
    run: run,
    loadAnalysis: loadAnalysis,
    parseNotes: parseNotes,
    generateInsights: generateInsights
  };

  console.log('[RehearsalAnalysis] Pipeline loaded');

})();
