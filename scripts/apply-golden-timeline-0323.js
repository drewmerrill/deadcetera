/**
 * One-time script: Apply golden standard timestamps to the 3/23/2026 rehearsal session.
 * Run from the browser console while signed into GrooveLinx.
 */
(async function applyGoldenTimeline0323() {
  'use strict';

  var golden = [
    // WARMUP JAM
    { start: '00:00:00', end: '00:08:10', title: 'Pierce Jam over GM', segType: 'jam',
      note: 'We like to start every band rehearsal with a jam listening session' },

    // JACK STRAW
    { start: '00:09:13', end: '00:09:48', title: 'Jack Straw', segType: 'restart',
      note: 'First try — false start' },
    { start: '00:10:15', end: '00:16:26', title: 'Jack Straw',
      note: 'Second try. Drew: on E7/F#7 section, do A-based 7th chord with Sus' },
    { start: '00:16:48', end: '00:18:30', title: 'Jack Straw',
      note: 'Solo section work. When Brian comes in with full chords, Drew plays on-beat chords then full BBB shrills (18:46 example). Great ending harmony Pierce and Brian. Pierce needs to learn chords. Pierce too quiet.' },
    { start: '00:19:07', end: '00:19:31', title: 'Jack Straw', segType: 'restart',
      note: 'Ending test' },
    { start: '00:19:47', end: '00:23:35', title: 'Jack Straw',
      note: 'From Leaving Texas through lead' },

    // AIN'T LIFE GRAND
    { start: '00:23:35', end: '00:23:47', title: "Ain't Life Grand", segType: 'restart',
      note: 'False start. Brian needs slide on before start. Why doesn\'t Pierce sing? Drew: work on coming right in after solo with soft verse' },
    { start: '00:23:47', end: '00:28:46', title: "Ain't Life Grand",
      note: 'Full run. Discussion after about whether to come right in on verse — agreed yes' },
    { start: '00:29:14', end: '00:32:48', title: "Ain't Life Grand",
      note: 'Ended early — band forgot how to end. Fix: 3.5x then only one time through Em G A' },

    // BIRDSONG
    { start: '00:33:07', end: '00:44:20', title: 'Birdsong',
      note: 'Jay came in on wrong rhythm and meandered. Trying to dissolve into chaos — no one following. Brian needs to cue comeback to chorus after teasing intro in jam. Bass flubs in chorus Chris. End with 4x the intro' },

    // WEST LA FADEAWAY
    { start: '00:45:23', end: '00:53:32', title: 'West LA Fadeaway',
      note: 'No harmonies on chorus? Drew: figure out who takes solo, what verses used, if chorus at end' },

    // CHILLY WATER
    { start: '00:54:00', end: '00:56:19', title: 'Chilly Water', segType: 'restart',
      note: 'Ended early. Drew and Chris start.' },
    { start: '00:56:45', end: '01:05:28', title: 'Chilly Water',
      note: 'At 1:00 off the rails out of rhythm but love Brian\'s effect! Not a fan of the new Chilly — go back to well-done version Brian mastered. 1:03 Brian\'s effects again, love it! Strong ending.' },

    // ESTIMATED PROPHET
    { start: '01:09:24', end: '01:17:14', title: 'Estimated Prophet',
      note: 'Full run-through. California harmonies weak — need one more singer. Fire Wheel needs another person. Drew messes up Dm tempo first time. During long jam Drew needs to chill and be subtle, not hammering chords. Go Brian at 1:15 onward! Jay needs to look up and slow down on ending.' },
    { start: '01:17:55', end: '01:22:47', title: 'Estimated Prophet',
      note: 'Second full run-through — tape cuts off at end' }
  ];

  function toSec(ts) {
    var p = ts.split(':').map(Number);
    return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
  }

  var segments = golden.map(function(g) {
    var startSec = toSec(g.start);
    var endSec = toSec(g.end);
    return {
      startSec: startSec,
      endSec: endSec,
      duration: endSec - startSec,
      songTitle: g.title,
      segType: g.segType || 'song',
      confirmed: true,
      _goldenStandard: true,
      notes: g.note || '',
      songMatch: {
        bestMatch: { title: g.title, score: 1.0 },
        confidence: 'high',
        explanation: ['Golden standard — manually verified by band'],
        needsReview: false
      },
      confidence: 1.0
    };
  });

  // Add gap segments between songs
  var withGaps = [];
  for (var i = 0; i < segments.length; i++) {
    if (i > 0) {
      var prevEnd = segments[i - 1].endSec;
      var currStart = segments[i].startSec;
      var gap = currStart - prevEnd;
      if (gap > 5) {
        withGaps.push({
          startSec: prevEnd,
          endSec: currStart,
          duration: gap,
          songTitle: null,
          segType: 'talking',
          confirmed: true,
          _goldenStandard: true,
          notes: '',
          songMatch: null,
          confidence: 0
        });
      }
    }
    withGaps.push(segments[i]);
  }

  console.log('[Golden 3/23] Built', withGaps.length, 'segments (' + segments.length + ' songs +', (withGaps.length - segments.length), 'gaps)');

  var db = firebaseDB;
  if (!db || typeof bandPath !== 'function') {
    console.error('[Golden] Firebase not available. Make sure you are signed in.');
    return;
  }

  var snap = await db.ref(bandPath('rehearsal_sessions')).once('value');
  var sessions = snap.val() || {};

  // Find session matching 3/23/2026
  var targetDate = '2026-03-23';
  var targetKey = null;
  Object.keys(sessions).forEach(function(k) {
    var s = sessions[k];
    var d = (s.date || '').substring(0, 10);
    if (d === targetDate) targetKey = k;
  });

  if (!targetKey) {
    console.warn('[Golden] No session found for', targetDate, '— creating new one');
    targetKey = 'rsess_golden_0323_' + Date.now().toString(36);
  }

  var uniqueSongs = segments
    .filter(function(s) { return s.segType === 'song' || s.segType === 'restart'; })
    .map(function(s) { return s.songTitle; })
    .filter(function(t, i, a) { return a.indexOf(t) === i; });

  var updates = {
    sessionId: targetKey,
    date: '2026-03-23T19:00:00.000Z',
    start_time: '2026-03-23T19:00:00.000Z',
    end_time: '2026-03-23T20:23:00.000Z',
    totalActualMin: 83,
    totalBudgetMin: 120,
    blocksCompleted: segments.length,
    totalBlocks: segments.length,
    audio_segments: withGaps,
    songsWorked: uniqueSongs,
    notes: 'Golden standard timeline — manually timestamped by Drew'
  };

  // Build label_overrides
  var overrides = {};
  segments.forEach(function(s) {
    var key = Math.round(s.startSec) + '_' + Math.round(s.endSec);
    overrides[key] = s.songTitle;
  });
  updates.label_overrides = overrides;

  if (!sessions[targetKey]) {
    await db.ref(bandPath('rehearsal_sessions/' + targetKey)).set(updates);
    console.log('[Golden 3/23] Created new session:', targetKey);
  } else {
    await db.ref(bandPath('rehearsal_sessions/' + targetKey)).update(updates);
    console.log('[Golden 3/23] Updated existing session:', targetKey);
  }

  console.log('[Golden 3/23] Done! ' + withGaps.length + ' segments written.');
  console.log('[Golden 3/23] ' + Object.keys(overrides).length + ' label overrides saved.');
  console.log('[Golden 3/23] Unique songs:', uniqueSongs.length, uniqueSongs.join(', '));

  if (typeof showToast === 'function') {
    showToast('3/23 timeline applied — ' + segments.length + ' entries, ' + uniqueSongs.length + ' songs');
  }
})();
