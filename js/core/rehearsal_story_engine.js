/**
 * rehearsal_story_engine.js
 * Converts raw event segmentation into a human-readable rehearsal story.
 *
 * Pure computation. No DOM, no Firebase.
 * Input: v2 event timeline + optional planned setlist
 * Output: story object with timeline, plan vs actual, coaching, highlights
 *
 * LOAD ORDER: after rehearsal_segmentation_engine.js
 */

(function() {
  'use strict';

  // ── UI Type Mapping ───────────────────────────────────────────────────────
  // Simplify 12 internal types → 7 user-facing types

  var UI_TYPES = {
    'song_full':     'Full Run',
    'song_partial':  'Partial',
    'song_attempt':  'Partial',
    'false_start':   'Restart',
    'retry':         'Restart',
    'section_work':  'Work',
    'ending_work':   'Work',
    'discussion':    'Talk',
    'warmup_jam':    'Jam',
    'jam':           'Jam',
    'off_rails':     'Jam',
    'strong_moment': 'Highlight',
    'break':         'Break',
    'unknown':       'Other'
  };

  var UI_COLORS = {
    'Full Run':  '#22c55e',
    'Partial':   '#a5b4fc',
    'Restart':   '#f87171',
    'Work':      '#fbbf24',
    'Talk':      '#94a3b8',
    'Jam':       '#c084fc',
    'Highlight': '#f59e0b',
    'Break':     '#475569',
    'Other':     '#64748b'
  };

  var UI_ICONS = {
    'Full Run':  '\u2705',
    'Partial':   '\u25B6',
    'Restart':   '\uD83D\uDD04',
    'Work':      '\uD83D\uDD27',
    'Talk':      '\uD83D\uDCAC',
    'Jam':       '\uD83C\uDFB8',
    'Highlight': '\u2B50',
    'Break':     '\u23F8',
    'Other':     '\u2022'
  };

  function _toUIType(eventType) {
    return UI_TYPES[eventType] || 'Other';
  }

  function _r1(v) { return Math.round(v * 10) / 10; }

  // ── Build Story ───────────────────────────────────────────────────────────

  function buildStory(v2Result, plannedSetlist) {
    if (!v2Result || !v2Result.events || !v2Result.events.length) {
      return { timeline: [], planVsActual: null, coaching: null, highlights: [] };
    }

    var events = v2Result.events;
    var timeline = _buildTimeline(events);
    var planVsActual = plannedSetlist ? _buildPlanVsActual(events, plannedSetlist) : null;
    var coaching = _buildCoaching(events, timeline, planVsActual);
    var highlights = _buildHighlights(events);

    return {
      events: events,
      story: {
        timeline: timeline,
        planVsActual: planVsActual,
        coaching: coaching,
        highlights: highlights
      }
    };
  }

  // ── Timeline: Group events by song ────────────────────────────────────────

  function _buildTimeline(events) {
    // Group consecutive events that share the same song title
    // Events without a song get grouped as "General"
    var groups = [];
    var current = null;

    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      var uiType = _toUIType(evt.type);

      // Skip breaks in grouping
      if (uiType === 'Break') continue;

      var songKey = evt.song || null;

      if (current && current._songKey === songKey && songKey !== null) {
        // Same song — extend group
        current.flow.push(uiType);
        current.events.push(evt);
        current.totalTimeSec += evt.duration;
      } else {
        // New group
        if (current) groups.push(current);
        current = {
          song: evt.song || (uiType === 'Talk' ? 'Discussion' : uiType === 'Jam' ? 'Jam Section' : 'Untitled'),
          _songKey: songKey,
          flow: [uiType],
          events: [evt],
          totalTimeSec: evt.duration,
          startTime: evt.start_time
        };
      }
    }
    if (current) groups.push(current);

    // Format output
    return groups.map(function(g) {
      var totalMin = _r1(g.totalTimeSec / 60);
      return {
        song: g.song,
        flow: g.flow,
        flowLabel: g.flow.join(' \u2192 '),
        totalTime: totalMin + ' min',
        totalTimeSec: g.totalTimeSec,
        startTime: g.startTime,
        eventCount: g.events.length,
        hasFullRun: g.flow.indexOf('Full Run') >= 0,
        hasRestart: g.flow.indexOf('Restart') >= 0,
        hasWork: g.flow.indexOf('Work') >= 0
      };
    });
  }

  // ── Plan vs Actual ────────────────────────────────────────────────────────

  function _buildPlanVsActual(events, plannedSetlist) {
    // plannedSetlist: array of song titles (strings) or objects with .title
    var planned = (plannedSetlist || []).map(function(s) {
      return typeof s === 'string' ? s : (s.title || s.name || String(s));
    });

    // Find which songs appeared in events
    var detected = {};
    for (var i = 0; i < events.length; i++) {
      if (events[i].song) {
        if (!detected[events[i].song]) {
          detected[events[i].song] = { totalSec: 0, types: [], count: 0 };
        }
        detected[events[i].song].totalSec += events[i].duration;
        detected[events[i].song].types.push(_toUIType(events[i].type));
        detected[events[i].song].count++;
      }
    }

    var completed = [];
    var skipped = [];
    var added = [];

    // Check planned songs
    for (var p = 0; p < planned.length; p++) {
      var title = planned[p];
      if (detected[title]) {
        var d = detected[title];
        completed.push({
          song: title,
          planned: true,
          totalTime: _r1(d.totalSec / 60) + ' min',
          totalTimeSec: d.totalSec,
          flow: d.types,
          hasFullRun: d.types.indexOf('Full Run') >= 0
        });
      } else {
        skipped.push({ song: title });
      }
    }

    // Check for songs NOT in the plan (added during rehearsal)
    var plannedSet = {};
    for (var ps = 0; ps < planned.length; ps++) plannedSet[planned[ps]] = true;
    Object.keys(detected).forEach(function(song) {
      if (!plannedSet[song]) {
        added.push({
          song: song,
          planned: false,
          totalTime: _r1(detected[song].totalSec / 60) + ' min',
          totalTimeSec: detected[song].totalSec,
          flow: detected[song].types
        });
      }
    });

    return {
      planned: planned.length,
      completed: completed.length,
      skipped: skipped.length,
      added: added.length,
      completionRate: planned.length > 0 ? Math.round((completed.length / planned.length) * 100) : 0,
      songs: { completed: completed, skipped: skipped, added: added }
    };
  }

  // ── Coaching Summary ──────────────────────────────────────────────────────

  function _buildCoaching(events, timeline, planVsActual) {
    var totalDuration = 0;
    var typeCounts = {};
    var typeDurations = {};
    var songAttempts = {};
    var restartSongs = [];

    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      var uiType = _toUIType(evt.type);
      totalDuration += evt.duration;
      typeCounts[uiType] = (typeCounts[uiType] || 0) + 1;
      typeDurations[uiType] = (typeDurations[uiType] || 0) + evt.duration;

      if (evt.song) {
        if (!songAttempts[evt.song]) songAttempts[evt.song] = { restarts: 0, attempts: 0, totalSec: 0 };
        songAttempts[evt.song].attempts++;
        songAttempts[evt.song].totalSec += evt.duration;
        if (uiType === 'Restart') {
          songAttempts[evt.song].restarts++;
          if (restartSongs.indexOf(evt.song) === -1) restartSongs.push(evt.song);
        }
      }
    }

    // Time allocation
    var timeAllocation = {};
    Object.keys(typeDurations).forEach(function(t) {
      if (t === 'Break') return;
      timeAllocation[t] = {
        minutes: _r1(typeDurations[t] / 60),
        percent: totalDuration > 0 ? Math.round((typeDurations[t] / totalDuration) * 100) : 0
      };
    });

    // Most problematic songs (most restarts)
    var problematic = Object.keys(songAttempts)
      .filter(function(s) { return songAttempts[s].restarts > 0; })
      .sort(function(a, b) { return songAttempts[b].restarts - songAttempts[a].restarts; })
      .slice(0, 3)
      .map(function(s) { return { song: s, restarts: songAttempts[s].restarts, totalTime: _r1(songAttempts[s].totalSec / 60) + ' min' }; });

    // Insights
    var insights = [];
    var talkPct = timeAllocation['Talk'] ? timeAllocation['Talk'].percent : 0;
    var playPct = (timeAllocation['Full Run'] ? timeAllocation['Full Run'].percent : 0) + (timeAllocation['Partial'] ? timeAllocation['Partial'].percent : 0);
    var restartCount = typeCounts['Restart'] || 0;

    if (talkPct > 30) insights.push({ type: 'warning', text: talkPct + '% of rehearsal was discussion. Try settling arrangement decisions before the session.' });
    if (talkPct > 0 && talkPct <= 15) insights.push({ type: 'strength', text: 'Minimal talk time (' + talkPct + '%). Efficient session.' });
    if (playPct >= 60) insights.push({ type: 'strength', text: playPct + '% of time spent playing. That\u2019s how bands get tighter.' });
    if (restartCount >= 4) insights.push({ type: 'warning', text: restartCount + ' restarts. Consider running through even if it\u2019s rough \u2014 full runs build confidence.' });
    if (restartCount === 0 && (typeCounts['Full Run'] || 0) >= 3) insights.push({ type: 'strength', text: 'Zero restarts and ' + typeCounts['Full Run'] + ' full runs. Clean session.' });
    if (problematic.length > 0) insights.push({ type: 'focus', text: problematic[0].song + ' needed ' + problematic[0].restarts + ' restart' + (problematic[0].restarts > 1 ? 's' : '') + '. Schedule dedicated section work.' });
    if (planVsActual && planVsActual.completionRate >= 90) insights.push({ type: 'strength', text: 'Covered ' + planVsActual.completionRate + '% of the plan. On track.' });
    if (planVsActual && planVsActual.skipped > 0) insights.push({ type: 'info', text: planVsActual.skipped + ' planned song' + (planVsActual.skipped > 1 ? 's' : '') + ' skipped. Add to next rehearsal.' });

    return {
      totalMinutes: _r1(totalDuration / 60),
      timeAllocation: timeAllocation,
      problematicSongs: problematic,
      restartCount: restartCount,
      insights: insights
    };
  }

  // ── Highlights ────────────────────────────────────────────────────────────

  function _buildHighlights(events) {
    var highlights = [];

    for (var i = 0; i < events.length; i++) {
      var evt = events[i];
      // Strong moments from event tags
      if (evt.tags && evt.tags.indexOf('strong_moment') >= 0) {
        highlights.push({
          type: 'strong_moment',
          song: evt.song || 'Unknown',
          startTime: evt.start_time,
          duration: evt.duration,
          label: 'Tight playing',
          description: (evt.song || 'This section') + ' was locked in \u2014 ' + _r1(evt.duration / 60) + ' min of solid groove.'
        });
      }
      // Manual annotations
      if (evt.tags && evt.tags.indexOf('manual') >= 0) {
        highlights.push({
          type: 'annotated',
          song: evt.song || 'Unknown',
          startTime: evt.start_time,
          duration: evt.duration,
          label: 'Marked',
          description: 'Manually tagged during review.'
        });
      }
      // Clean full runs (no preceding restart)
      if (evt.type === 'song_full' && evt.song) {
        var prevWasRestart = (i > 0 && (events[i-1].type === 'false_start' || events[i-1].type === 'retry'));
        if (!prevWasRestart) {
          highlights.push({
            type: 'clean_run',
            song: evt.song,
            startTime: evt.start_time,
            duration: evt.duration,
            label: 'Clean full run',
            description: evt.song + ' \u2014 nailed it first try. ' + _r1(evt.duration / 60) + ' min.'
          });
        }
      }
    }

    // Sort by impact: strong_moment > clean_run > annotated
    var priority = { strong_moment: 0, clean_run: 1, annotated: 2 };
    highlights.sort(function(a, b) { return (priority[a.type] || 9) - (priority[b.type] || 9); });

    return highlights.slice(0, 5); // top 5 highlights
  }

  // ── Headline Generator ────────────────────────────────────────────────────
  // One-line summary for the rehearsal

  function generateHeadline(story) {
    if (!story || !story.coaching) return 'Rehearsal complete.';
    var c = story.coaching;
    var fullRuns = 0;
    if (story.timeline) {
      for (var i = 0; i < story.timeline.length; i++) {
        if (story.timeline[i].hasFullRun) fullRuns++;
      }
    }

    if (c.restartCount === 0 && fullRuns >= 3) return fullRuns + ' songs nailed \u2014 zero restarts. Strong session.';
    if (c.restartCount >= 4) return 'Rough patches but you pushed through. ' + fullRuns + ' full run' + (fullRuns !== 1 ? 's' : '') + '.';
    if (fullRuns >= 5) return fullRuns + ' songs covered in ' + c.totalMinutes + ' min. Productive.';
    if (c.insights.length && c.insights[0].type === 'strength') return c.insights[0].text;
    return fullRuns + ' full run' + (fullRuns !== 1 ? 's' : '') + ', ' + c.restartCount + ' restart' + (c.restartCount !== 1 ? 's' : '') + '. ' + c.totalMinutes + ' min total.';
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.RehearsalStoryEngine = {
    buildStory: buildStory,
    generateHeadline: generateHeadline,
    UI_TYPES: UI_TYPES,
    UI_COLORS: UI_COLORS,
    UI_ICONS: UI_ICONS,
    toUIType: _toUIType
  };

  console.log('\uD83D\uDCD6 RehearsalStoryEngine loaded');

})();
