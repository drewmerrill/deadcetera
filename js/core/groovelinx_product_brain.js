/**
 * groovelinx_product_brain.js
 * Unified access layer for rehearsal insights.
 *
 * Wraps: RehearsalSegmentationEngine, RehearsalStoryEngine, GLStore
 * All UI components call this instead of individual engines.
 *
 * No duplicate logic. Story engine is source of truth for messaging.
 * Segmentation engine is source of truth for events.
 * This module shapes the output for UI consumption.
 *
 * LOAD ORDER: after rehearsal_story_engine.js and groovelinx_store.js
 */

(function() {
  'use strict';

  // Cache last result per rehearsal
  var _cache = {};

  // ── Main API ──────────────────────────────────────────────────────────────

  /**
   * Get unified rehearsal insight from any combination of inputs.
   *
   * @param {object} opts
   *   opts.audioBuffer   — AudioBuffer (triggers segmentation)
   *   opts.v2Result      — pre-computed v2 segmentation result
   *   opts.plannedSetlist — array of song titles or {title} objects
   *   opts.rehearsalId   — for caching
   *   opts.annotations   — manual timestamp annotations
   * @returns {object} unified insight
   */
  function getRehearsalInsight(opts) {
    opts = opts || {};
    var cacheKey = opts.rehearsalId || 'latest';

    // Return cached if available
    if (_cache[cacheKey] && !opts.force) return _cache[cacheKey];

    // Step 1: Get v2 segmentation result
    var v2Result = opts.v2Result || null;
    if (!v2Result && opts.audioBuffer) {
      var segOpts = opts.annotations ? { annotations: opts.annotations } : {};
      if (typeof GLStore !== 'undefined' && GLStore.segmentRehearsalAudioV2) {
        v2Result = GLStore.segmentRehearsalAudioV2(opts.audioBuffer, segOpts);
      } else if (typeof RehearsalSegmentationEngine !== 'undefined' && RehearsalSegmentationEngine.segmentAudioV2) {
        var features = {
          channelData: opts.audioBuffer.getChannelData(0),
          sampleRate: opts.audioBuffer.sampleRate,
          duration: opts.audioBuffer.duration
        };
        v2Result = RehearsalSegmentationEngine.segmentAudioV2(features, segOpts);
      }
    }

    if (!v2Result || !v2Result.events || !v2Result.events.length) {
      return _emptyInsight('No segmentation data available.');
    }

    // Step 2: Build story (includes narrative + headline)
    var storyResult = null;
    if (typeof RehearsalStoryEngine !== 'undefined') {
      storyResult = RehearsalStoryEngine.buildStory(v2Result, opts.plannedSetlist || null);
    }

    if (!storyResult) {
      return _emptyInsight('Story engine not available.');
    }

    // Step 3: Shape unified output
    var story = storyResult.story || {};
    var narrative = storyResult.narrative || {};
    var coaching = story.coaching || {};

    // Compute overall confidence from event confidences
    var events = v2Result.events;
    var confSum = 0;
    for (var i = 0; i < events.length; i++) confSum += (events[i].confidence || 0);
    var avgConf = events.length ? Math.round((confSum / events.length) * 100) / 100 : 0;

    var insight = {
      // Top-level messaging (source: narrative engine)
      headline: storyResult.headline,
      narrative: narrative,

      // Structured story data (source: story engine)
      story: story,

      // Coaching layer (derived from story.coaching, shaped for UI)
      coaching: {
        primaryFocus: narrative.biggestIssue || 'No major issues.',
        nextAction: narrative.nextAction || 'Keep this pace.',
        issues: (coaching.insights || []).filter(function(i) { return i.type === 'warning' || i.type === 'focus'; }),
        strengths: (coaching.insights || []).filter(function(i) { return i.type === 'strength'; }),
        timeAllocation: coaching.timeAllocation || {},
        problematicSongs: coaching.problematicSongs || [],
        totalMinutes: coaching.totalMinutes || 0,
        restartCount: coaching.restartCount || 0
      },

      // Pre-shaped UI blocks (ready for rendering)
      ui: {
        topCard: {
          headline: storyResult.headline,
          whatHappened: narrative.whatHappened || '',
          biggestIssue: narrative.biggestIssue || '',
          strongestMoment: narrative.strongestMoment || '',
          nextAction: narrative.nextAction || ''
        },
        timeline: (story.timeline || []).map(function(t) {
          var SE = (typeof RehearsalStoryEngine !== 'undefined') ? RehearsalStoryEngine : null;
          return {
            song: t.song,
            flow: t.flow,
            flowLabel: t.flowLabel,
            totalTime: t.totalTime,
            hasFullRun: t.hasFullRun,
            hasRestart: t.hasRestart,
            icons: SE ? t.flow.map(function(f) { return (SE.UI_ICONS[f] || '') + ' ' + f; }) : t.flow,
            colors: SE ? t.flow.map(function(f) { return SE.UI_COLORS[f] || '#64748b'; }) : []
          };
        }),
        highlights: (story.highlights || []).map(function(h) {
          return {
            type: h.type,
            song: h.song,
            label: h.label,
            description: h.description,
            startTime: h.startTime
          };
        }),
        planVsActual: story.planVsActual || null
      },

      // Confidence metrics
      confidence: {
        overall: avgConf,
        segmentation: v2Result.summary ? (v2Result.summary.songFull > 0 ? 'high' : v2Result.summary.totalEvents > 3 ? 'medium' : 'low') : 'unknown',
        eventCount: events.length
      },

      // Raw data (for debugging / advanced UI)
      _raw: {
        v2Result: v2Result,
        storyResult: storyResult
      }
    };

    // Cache
    _cache[cacheKey] = insight;
    return insight;
  }

  // ── Convenience: Get insight from stored session ─────────────────────────

  function getInsightFromSession(sessionId) {
    // Try cached first
    if (_cache[sessionId]) return _cache[sessionId];

    // Try stored v2 timeline
    try {
      var stored = localStorage.getItem('gl_timeline_v2');
      if (stored) {
        var v2Result = JSON.parse(stored);
        return getRehearsalInsight({ v2Result: v2Result, rehearsalId: sessionId });
      }
    } catch(e) {}

    return _emptyInsight('No stored segmentation for this session.');
  }

  // ── Clear cache ─────────────────────────────────────────────────────────

  function clearCache(rehearsalId) {
    if (rehearsalId) { delete _cache[rehearsalId]; }
    else { _cache = {}; }
  }

  // ── Empty insight ───────────────────────────────────────────────────────

  function _emptyInsight(reason) {
    return {
      headline: 'Rehearsal complete.',
      narrative: { whatHappened: '', biggestIssue: '', strongestMoment: '', nextAction: '' },
      story: { timeline: [], planVsActual: null, coaching: null, highlights: [] },
      coaching: { primaryFocus: '', nextAction: '', issues: [], strengths: [], timeAllocation: {}, problematicSongs: [], totalMinutes: 0, restartCount: 0 },
      ui: { topCard: { headline: 'Rehearsal complete.', whatHappened: '', biggestIssue: '', strongestMoment: '', nextAction: '' }, timeline: [], highlights: [], planVsActual: null },
      confidence: { overall: 0, segmentation: 'none', eventCount: 0 },
      _empty: true,
      _reason: reason
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.GLProductBrain = {
    getRehearsalInsight: getRehearsalInsight,
    getInsightFromSession: getInsightFromSession,
    clearCache: clearCache
  };

  console.log('\uD83E\uDDE0 GLProductBrain loaded');

})();
