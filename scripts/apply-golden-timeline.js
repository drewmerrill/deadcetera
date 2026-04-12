/**
 * One-time script: Apply golden standard timestamps to the 4/3/2026 rehearsal session.
 * Run from the browser console while signed into GrooveLinx.
 *
 * Usage: paste this entire script into the browser console on the GrooveLinx app.
 */
(async function applyGoldenTimeline() {
  'use strict';

  // ── Golden standard: actual song timestamps from 4/3/2026 rehearsal ──
  var golden = [
    { start: '00:00:00', end: '00:01:26', title: 'Bulldog Jam', note: 'Beatles cover' },
    { start: '00:03:27', end: '00:07:28', title: 'Stella Blue' },
    { start: '00:11:48', end: '00:12:38', title: 'Uprising', note: 'MUSE' },
    { start: '00:21:40', end: '00:25:44', title: "Ain't Life Grand" },
    { start: '00:25:50', end: '00:32:11', title: 'Jack Straw' },
    { start: '00:35:49', end: '00:42:45', title: 'Life During Wartime' },
    { start: '00:45:13', end: '00:55:40', title: 'Birdsong', note: 'peak at 52:06, last chorus 54:34' },
    { start: '01:01:43', end: '01:09:47', title: 'West LA Fadeaway', note: 'do 2-3 times?' },
    { start: '01:17:14', end: '01:26:37', title: 'Chilly Water', note: '1:22:50 & 1:25:08 rhythm issues' },
    { start: '01:28:15', end: '01:39:24', title: 'Shakedown Street' },
    // BREAK
    { start: '02:09:37', end: '02:10:18', title: 'Estimated Prophet', segType: 'restart', note: 'false start #1' },
    { start: '02:10:57', end: '02:12:00', title: 'Estimated Prophet', segType: 'restart', note: 'false start #2' },
    { start: '02:12:35', end: '02:16:34', title: 'Estimated Prophet', segType: 'restart', note: 'false start #3 — 2:15:31/2:15:57' },
    { start: '02:21:13', end: '02:22:30', title: 'Estimated Prophet', segType: 'restart', note: 'false start #4' },
    { start: '02:23:39', end: '02:27:35', title: 'Estimated Prophet', segType: 'restart', note: 'false start #5' },
    { start: '02:29:02', end: '02:33:00', title: 'Estimated Prophet', segType: 'restart', note: 'false start #6 — chorus to end' },
    { start: '02:34:28', end: '02:43:52', title: 'Estimated Prophet', note: 'chorus to end — full take' },
    { start: '02:51:40', end: '03:04:10', title: 'Barstools and Dreamers' },
    { start: '03:09:42', end: '03:10:30', title: 'Green-Eyed Lady', segType: 'restart', note: 'false starts' },
    { start: '03:10:33', end: '03:13:47', title: 'Green-Eyed Lady', note: 'stopped halfway through' },
    { start: '03:14:23', end: '03:22:04', title: 'Green-Eyed Lady', note: 'full take' },
    { start: '03:25:50', end: '03:32:30', title: 'Stir It Up' },
    { start: '03:37:20', end: '03:48:10', title: 'Eyes of the World', note: 'peak 3:43:50' },
    { start: '03:48:11', end: '03:50:33', title: 'G#min-Emaj7-Bbmin-G#min-Emaj7', segType: 'jam', note: 'chord progression jam' },
    { start: '03:53:33', end: '03:58:43', title: 'Cumberland Blues' },
    { start: '03:59:42', end: '04:02:26', title: 'Game of Thrones' },
    { start: '04:03:15', end: '04:08:25', title: 'Scarlet Begonias' },
    { start: '04:08:26', end: '04:16:10', title: 'Fire on the Mountain', note: 'peak at 4:13:00' },
    { start: '04:16:52', end: '04:18:56', title: 'MUSE Tune', note: 'by Chris' }
  ];

  // Parse HH:MM:SS to seconds
  function toSec(ts) {
    var p = ts.split(':').map(Number);
    return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
  }

  // Build segments array
  var segments = golden.map(function(g, i) {
    var startSec = toSec(g.start);
    var endSec = toSec(g.end);
    var seg = {
      startSec: startSec,
      endSec: endSec,
      duration: endSec - startSec,
      songTitle: g.title,
      segType: g.segType || 'song',
      confirmed: true,
      _goldenStandard: true,
      songMatch: {
        bestMatch: { title: g.title, score: 1.0 },
        confidence: 'high',
        explanation: ['Golden standard — manually verified by band'],
        needsReview: false
      },
      confidence: 1.0
    };
    if (g.note) seg.notes = g.note;
    return seg;
  });

  // Add gap segments (talking/break) between songs
  var withGaps = [];
  for (var i = 0; i < segments.length; i++) {
    if (i > 0) {
      var prevEnd = segments[i - 1].endSec;
      var currStart = segments[i].startSec;
      var gap = currStart - prevEnd;
      if (gap > 10) {
        // Check if this is the break (gap > 30 min)
        var isBreak = gap > 1800;
        withGaps.push({
          startSec: prevEnd,
          endSec: currStart,
          duration: gap,
          songTitle: null,
          segType: isBreak ? 'talking' : 'talking',
          confirmed: true,
          _goldenStandard: true,
          notes: isBreak ? 'BREAK' : '',
          songMatch: null,
          confidence: 0
        });
      }
    }
    withGaps.push(segments[i]);
  }

  console.log('[Golden] Built', withGaps.length, 'segments (' + segments.length + ' songs +', (withGaps.length - segments.length), 'gaps)');

  // Find the 4/3/2026 session
  var db = firebaseDB;
  if (!db || typeof bandPath !== 'function') {
    console.error('[Golden] Firebase not available. Make sure you are signed in.');
    return;
  }

  var snap = await db.ref(bandPath('rehearsal_sessions')).once('value');
  var sessions = snap.val();
  if (!sessions) {
    console.error('[Golden] No rehearsal sessions found');
    return;
  }

  // Find session matching 4/3/2026
  var targetDate = '2026-04-03';
  var targetKey = null;
  var targetSession = null;
  Object.keys(sessions).forEach(function(k) {
    var s = sessions[k];
    var d = (s.date || '').substring(0, 10);
    if (d === targetDate) {
      targetKey = k;
      targetSession = s;
    }
  });

  if (!targetKey) {
    console.warn('[Golden] No session found for', targetDate);
    console.log('[Golden] Available sessions:', Object.keys(sessions).map(function(k) {
      return k + ' → ' + (sessions[k].date || 'no date');
    }));
    // Create a new session if none exists
    targetKey = 'rsess_golden_' + Date.now().toString(36);
    console.log('[Golden] Creating new session:', targetKey);
    targetSession = {
      sessionId: targetKey,
      date: '2026-04-03T19:00:00.000Z',
      start_time: '2026-04-03T19:00:00.000Z',
      end_time: '2026-04-03T23:19:00.000Z',
      totalActualMin: 259,
      totalBudgetMin: 240,
      blocksCompleted: segments.length,
      totalBlocks: segments.length,
      songsWorked: segments.filter(function(s) { return s.segType === 'song'; }).map(function(s) { return s.songTitle; }).filter(function(t, i, a) { return a.indexOf(t) === i; }),
      notes: 'Golden standard timeline — manually timestamped by Drew'
    };
  }

  // Write segments + session metadata
  var updates = {
    audio_segments: withGaps,
    songsWorked: segments.filter(function(s) { return s.segType === 'song'; }).map(function(s) { return s.songTitle; }).filter(function(t, i, a) { return a.indexOf(t) === i; }),
    totalActualMin: Math.round(withGaps[withGaps.length - 1].endSec / 60),
    blocksCompleted: segments.length,
    totalBlocks: segments.length
  };

  // Also build label_overrides for persistence across re-analyses
  var overrides = {};
  segments.forEach(function(s) {
    var key = Math.round(s.startSec) + '_' + Math.round(s.endSec);
    overrides[key] = s.songTitle;
  });
  updates.label_overrides = overrides;

  // If creating new session, set the full object
  if (!sessions[targetKey]) {
    Object.assign(targetSession, updates);
    await db.ref(bandPath('rehearsal_sessions/' + targetKey)).set(targetSession);
    console.log('[Golden] Created new session:', targetKey);
  } else {
    await db.ref(bandPath('rehearsal_sessions/' + targetKey)).update(updates);
    console.log('[Golden] Updated existing session:', targetKey);
  }

  console.log('[Golden] ✅ Done! ' + withGaps.length + ' segments written.');
  console.log('[Golden] ' + Object.keys(overrides).length + ' label overrides saved.');
  console.log('[Golden] Unique songs:', updates.songsWorked.length);
  console.log('[Golden] Reload the Rehearsal page to see the updated timeline.');

  if (typeof showToast === 'function') {
    showToast('✅ Golden timeline applied — ' + segments.length + ' songs timestamped. Reload to see.');
  }
})();
