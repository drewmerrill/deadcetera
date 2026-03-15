/**
 * gl-inline-help.js — Help Layer 1: Inline Contextual Guidance
 *
 * Provides short, workflow-aware help content for GrooveLinx surfaces.
 * Pure content module — no Firebase, no side effects.
 * UI components call these functions to get help text for tooltips,
 * empty states, and inline explainers.
 *
 * LOAD ORDER: anytime before UI files that consume it.
 */

(function () {
  'use strict';

  // ── Recording Setup Q&A ────────────────────────────────────────────────────

  var RECORDING_SETUP = {
    phone: {
      title: 'Phone Recording',
      level: 'Easiest',
      icon: '📱',
      description: 'Record with your phone\'s voice memo app. Place it 8–10 feet from the band, chest height on a stable surface. Not on the floor, not behind amps, not next to the drum kit.',
      tip: 'This is the fastest way to start. Audio quality is good enough for AI segmentation and review.',
    },
    portable: {
      title: 'Portable Room Recorder',
      level: 'Recommended',
      icon: '🎙️',
      description: 'A Zoom, Tascam, or similar handheld recorder gives better stereo imaging and dynamic range. Same placement rules: 8–10 feet out, chest height, away from drums.',
      tip: 'Best balance of quality and simplicity. Great for the Rehearsal Chopper and groove analysis.',
    },
    board: {
      title: 'Board Mix',
      level: 'Advanced',
      icon: '🎛️',
      description: 'If your rehearsal space has a mixing board, record a stereo submix output. You\'ll get the cleanest signal but it won\'t capture the room feel.',
      tip: 'Best signal quality, but setup takes more effort. Not required — phone or portable is usually enough.',
    },
  };

  var RECORDING_TIPS = [
    'You don\'t need a fancy setup. A phone recording is enough to start using AI rehearsal analysis.',
    'Place the recorder 8–10 feet from the band at chest height — this gives the best balance.',
    'Avoid placing the mic next to drums, on the floor, or directly behind guitar amps.',
    'Hit record at the start, let it run the whole rehearsal, then upload the full file to Rehearsal Chopper.',
    'GrooveLinx AI will automatically detect song breaks, silence gaps, and likely restarts.',
    'Real-time recording is not required — upload after the fact is the primary workflow.',
  ];

  // ── Inline Explainers ──────────────────────────────────────────────────────

  var EXPLAINERS = {
    // Rehearsal Chopper
    'chopper-segments': {
      title: 'AI Segments',
      text: 'GrooveLinx analyzed the audio energy to find where songs start and stop. Colored badges show what the AI thinks each section is — music, speech, silence, or a restart. You can correct any of these.',
    },
    'chopper-kind': {
      title: 'Segment Kind',
      text: 'Music = someone playing. Speech = talking between songs. Silence = a clear gap. The AI guesses based on energy levels — change it if it\'s wrong.',
    },
    'chopper-intent': {
      title: 'Segment Intent',
      text: 'Attempt = a real take of a song. Restart = a false start that was abandoned. Discussion = band talking. Tuning = instruments being adjusted. These help GrooveLinx understand your rehearsal flow.',
    },
    'chopper-confidence': {
      title: 'Confidence',
      text: 'How sure the AI is about this classification. 80%+ means fairly confident. Below 50% means it\'s guessing — verify and correct these first.',
    },

    // Readiness
    'readiness-delta': {
      title: 'Readiness Change',
      text: 'The difference in band readiness scores before and after this rehearsal. Green = improved. Red = declined. This reflects actual score changes, not estimates.',
    },

    // Groove / Pocket
    'groove-label': {
      title: 'Groove Quality',
      text: 'Compares the band\'s rhythmic tightness at the start vs end of the session. Tighter = the band locked in over time. Looser = timing drifted. Based on Pocket Meter data when available.',
    },

    // Scorecard
    'scorecard-score': {
      title: 'Rehearsal Score',
      text: 'A composite score (0–100) based on: how many agenda items you completed (40%), how much of the planned time you covered (25%), whether you did the hard work like repairs and new songs (20%), and time efficiency (15%).',
    },
    'scorecard-label': {
      title: 'Session Label',
      text: 'Excellent = 85+. Strong progress = 65+. Mixed = 40+. Low-impact = below 40. The label reflects both completion and quality of practice.',
    },

    // Agenda
    'agenda-reason': {
      title: 'Why This Song?',
      text: 'The agenda engine picked this song based on readiness scores, practice history, upcoming performances, and known weak spots. The reason text explains the primary factor.',
    },
    'agenda-carry-forward': {
      title: 'Carry-Forward Priority',
      text: 'This song was flagged because it was skipped or showed no improvement in recent sessions. The agenda automatically boosts these songs so they don\'t fall through the cracks.',
    },

    // Weak Spots
    'weak-spots': {
      title: 'Recurring Weak Spots',
      text: 'Songs that appear here have been repeatedly skipped, show stalled readiness, or remain below target after multiple rehearsals. The agenda engine automatically prioritizes them.',
    },

    // Practice Radar
    'practice-radar': {
      title: 'Practice Radar',
      text: 'Songs ranked by how much rehearsal attention they need. Combines readiness, practice recency, gig exposure, and member variance. Tap a song to open it and update your readiness.',
    },

    // Practice Attention
    'practice-attention': {
      title: 'Practice Attention Score',
      text: 'A composite score showing how much this song needs rehearsal right now. Based on band readiness, how recently it was practiced, whether it\'s on an upcoming setlist, and member score gaps.',
    },

    // How GrooveLinx works
    'how-it-works': {
      title: 'How GrooveLinx Intelligence Works',
      text: '🎵 Record → ✂️ AI segments → ✏️ You correct → 🏁 Scorecard → ⚠️ Weak spots detected → 📋 Next agenda built automatically. Each rehearsal makes the system smarter.',
    },

    // Now Playing
    'now-playing': {
      title: 'Now Playing',
      text: 'The song you\'re currently focused on. This persists across pages — it\'s your working context. Set it from any song detail panel. Clear it with the ✕ button.',
    },

    // Command Center
    'command-center': {
      title: 'Command Center',
      text: 'Your band\'s operational brain. Answers three questions: What should we work on next? Are we improving? Are we ready for the gig? Scroll down to see your Priority Queue and recent progress.',
    },
    'gig-confidence': {
      title: 'Gig Confidence',
      text: 'A show-level summary based on setlist readiness, recent rehearsals, and groove trends. Strong / Solid / Trending Up / Cautious / At Risk. Work the Priority Queue items to move this up.',
    },
    'priority-queue': {
      title: 'Priority Queue',
      text: 'The top actions to take right now, ranked by urgency. Items adapt — things you ignore get escalated, things you act on cool down. Tap any item to jump straight to that action.',
    },
    'band-health': {
      title: 'Band Health',
      text: 'Quick-glance metrics. Readiness = % of songs at gig threshold. Weak Songs = how many are below it. Tap any tile to drill into that area.',
    },
    'impact-feedback': {
      title: 'What Changed',
      text: 'Improvements from your recent actions. Green = readiness or groove improved. Purple = new capability unlocked. Check here after rehearsals to see what moved.',
    },
    'band-momentum': {
      title: 'Band Momentum',
      text: 'Overall direction of the band based on rehearsal scores, readiness trends, groove quality, and practice frequency. Keep rehearsing regularly and improving weak songs to push this up.',
    },
    'setlist-readiness': {
      title: 'Setlist Readiness',
      text: 'What percentage of songs on the gig\'s linked setlist are at or above the gig-ready threshold. The "All Songs" tile in Band Health below shows the full catalog number.',
    },
    'rehearsal-timeline': {
      title: 'Rehearsal Timeline',
      text: 'A visual strip showing how your last rehearsal session broke down — blue for music, yellow for speech, gray for silence. Hover segments for details. Upload a recording to generate this.',
    },

    // Song Intelligence
    'song-intelligence': {
      title: 'Song Intelligence',
      text: 'Per-song diagnostic: band readiness average, top gap (who needs work), and practice priority. Rate your readiness on the sliders below to update this.',
    },
    'song-readiness': {
      title: 'Band Readiness Score',
      text: 'Average of all band members\' ratings. 5 = locked in, 4 = almost there, 3 = getting there, 2 = knows the basics, 1 = never played it. Slide the bar below to rate yours.',
    },

    // Stage Plot
    'stage-plot': {
      title: 'Stage Plot',
      text: 'Visual stage layout showing where each musician and piece of gear goes. Add elements from the palette, set channel numbers, and export as a printable PDF to send to venues.',
    },

    // Ideas Board + Discussions
    'ideas-board': {
      title: 'Ideas Board',
      text: 'Shared space for song suggestions, jam ideas, and cover proposals. Paste YouTube or Spotify links and they\'re auto-detected. Create polls to vote on decisions.',
    },
    'song-discussion': {
      title: 'Song Discussion',
      text: 'Per-song comment thread. Talk about arrangements, tempo, harmony, or rehearsal notes right on the song. Pin important messages so they stay at the top.',
    },

    // Stoner Mode
    'stoner-mode': {
      title: 'Stoner Mode',
      text: 'Low-brain rehearsal cockpit. Choose Practice (search for charts), Rehearsal (outcomes + streak), or Gig (setlist chart access). Mark songs GOOD, NEEDS WORK, or TRAINWRECK.',
    },

    // Pocket Meter advanced
    'pocket-meter': {
      title: 'Pocket Meter',
      text: 'Live tempo and groove analysis. LIVE TEMPO mode tracks BPM stability. IN THE POCKET mode measures beat timing precision. Shows groove score, variance, and microtiming deviation.',
    },
    'groove-score': {
      title: 'Groove Score',
      text: 'Composite groove quality metric (0-100). Combines tempo stability (40%), beat precision (40%), and timing variance (20%). Higher = tighter groove.',
    },

    // Coaching signal
    'song-coaching': {
      title: 'Coaching Signal',
      text: 'One-line practice hint based on your rehearsal data. Tells you what to focus on: restart patterns, practice decay, readiness gaps, or upcoming gig exposure.',
    },

    // Rehearsal Brief
    'rehearsal-brief': {
      title: 'Rehearsal Brief',
      text: 'Auto-generated pre-rehearsal summary showing which songs need work, practice focus areas, and discussion activity. Check this before each rehearsal.',
    },
  };

  // ── Empty / First-Use States ───────────────────────────────────────────────

  var EMPTY_STATES = {
    'no-rehearsal-upload': {
      icon: '🎵',
      title: 'No rehearsal recording yet',
      text: 'Drop an MP3 of your rehearsal here. GrooveLinx will detect song breaks automatically.',
      cta: 'Record your next rehearsal with your phone and upload afterward.',
    },
    'no-scorecard': {
      icon: '🏁',
      title: 'No rehearsal scorecard yet',
      text: 'Complete a rehearsal agenda to get your first scorecard with score, highlights, and recommendations.',
      cta: 'Start from the Suggested Rehearsal Agenda on the Home page.',
    },
    'no-weak-spots': {
      icon: '✅',
      title: 'No recurring weak spots',
      text: 'After 2+ rehearsal sessions, GrooveLinx will identify songs that need extra attention based on patterns across sessions.',
      cta: 'Keep rehearsing — patterns emerge automatically.',
    },
    'first-chopper': {
      icon: '✂️',
      title: 'Welcome to Rehearsal Chopper',
      text: 'Upload a full rehearsal recording. The AI will detect where songs start and stop, mark silence gaps, and identify restarts. You can then correct and name each segment.',
      cta: 'Drag & drop an MP3 to get started.',
    },
    'first-segments': {
      icon: '🤖',
      title: 'AI has pre-cut your recording',
      text: 'Each colored section is a detected segment. Blue = music, yellow = speech, gray = silence. Drag orange markers to adjust boundaries. Use the dropdowns to correct what the AI got wrong.',
      cta: 'Verify the first few segments — the AI improves as you correct.',
    },
  };

  // ── Workflow Next Steps ──────────────────────────────────────────────────

  var NEXT_STEPS = {
    'after-segmentation': {
      title: 'What to do next',
      steps: [
        'Review each segment — correct restart and discussion labels first.',
        'Assign song names to music segments from the dropdown.',
        'Exclude non-music sections (tuning, breaks) with 🚫.',
        'Save named segments as takes for your Best Shot library.',
      ],
    },
    'after-scorecard': {
      title: 'How to use this scorecard',
      steps: [
        'Check the highlighted carry-forward songs — they need attention next session.',
        'Recurring weak spots automatically boost songs in your next agenda.',
        'Recommendations below suggest specific next actions.',
      ],
    },
    'weak-spots-context': {
      title: 'About weak spots',
      steps: [
        'Songs here are already being boosted in agenda generation.',
        'To improve detection, keep readiness scores updated after each rehearsal.',
        'Skipping a song twice flags it automatically — commit to it or remove it from rotation.',
      ],
    },
    'pre-upload': {
      title: 'Recording your rehearsal',
      steps: [
        '📱 Phone is easiest — voice memo app, 8–10 ft from band, chest height.',
        '🎙️ Portable recorder is recommended — better stereo and dynamic range.',
        '🎛️ Board mix is advanced — cleanest signal but more setup.',
        'Real-time capture is optional. Upload after the fact is the primary workflow.',
      ],
    },
    'how-groovelinx-works': {
      title: 'How GrooveLinx intelligence works',
      steps: [
        '🎵 Record your rehearsal → upload the full file.',
        '✂️ AI segments the recording into songs, breaks, and restarts.',
        '✏️ You correct and confirm what the AI got wrong.',
        '🏁 GrooveLinx scores the session and tracks progress.',
        '⚠️ Recurring weak spots surface automatically across sessions.',
        '📋 Your next rehearsal agenda is built from everything learned.',
      ],
    },
  };

  // ── Public Helpers ─────────────────────────────────────────────────────────

  /**
   * Get an inline explainer by key.
   * @param {string} key
   * @returns {object|null} { title, text }
   */
  function getExplainer(key) {
    return EXPLAINERS[key] || null;
  }

  /**
   * Get an empty state by key.
   * @param {string} key
   * @returns {object|null} { icon, title, text, cta }
   */
  function getEmptyState(key) {
    return EMPTY_STATES[key] || null;
  }

  /**
   * Get recording setup info.
   * @param {string} [type] 'phone'|'portable'|'board' — or null for all
   */
  function getRecordingSetup(type) {
    if (type) return RECORDING_SETUP[type] || null;
    return RECORDING_SETUP;
  }

  /**
   * Get random recording tip.
   */
  function getRecordingTip() {
    return RECORDING_TIPS[Math.floor(Math.random() * RECORDING_TIPS.length)];
  }

  /**
   * Get workflow next-step guidance by key.
   * @param {string} key
   * @returns {object|null} { title, steps[] }
   */
  function getNextSteps(key) {
    return NEXT_STEPS[key] || null;
  }

  /**
   * Render a compact next-step banner as HTML string.
   * Dismissible. Shows numbered steps.
   * @param {string} key  NEXT_STEPS key
   * @param {string} [dismissId]  localStorage key to remember dismissal
   * @returns {string} HTML or empty string
   */
  function renderNextStepBanner(key, dismissId) {
    if (dismissId) {
      try { if (localStorage.getItem(dismissId)) return ''; } catch(e) {}
    }
    var ns = NEXT_STEPS[key];
    if (!ns || !ns.steps || !ns.steps.length) return '';
    var dismissAttr = dismissId ? ' onclick="try{localStorage.setItem(\'' + dismissId + '\',\'1\')}catch(e){}this.parentElement.remove()"' : ' onclick="this.parentElement.remove()"';
    var stepsHtml = ns.steps.map(function(s, i) {
      return '<div style="display:flex;gap:6px;padding:2px 0"><span style="color:#818cf8;font-weight:700;flex-shrink:0">' + (i + 1) + '.</span><span>' + s + '</span></div>';
    }).join('');
    return '<div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:0.78em;color:var(--text-muted,#94a3b8);position:relative">'
      + '<div style="font-weight:700;color:#818cf8;margin-bottom:6px">' + ns.title + '</div>'
      + stepsHtml
      + '<button' + dismissAttr + ' style="position:absolute;top:6px;right:8px;background:none;border:none;color:#475569;cursor:pointer;font-size:0.9em">✕</button>'
      + '</div>';
  }

  /**
   * Render a compact inline help tooltip trigger.
   * Returns HTML string for a small ⓘ button that shows help on click.
   * @param {string} key  Explainer key
   * @returns {string} HTML
   */
  function renderHelpTrigger(key) {
    var exp = EXPLAINERS[key];
    if (!exp) return '';
    var safeText = (exp.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var safeTitle = (exp.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return '<button class="gl-help-icon" onclick="event.stopPropagation();glInlineHelp.showPopover(this,\'' + safeTitle + '\',\'' + safeText + '\')" title="' + safeTitle + '">ⓘ</button>';
  }

  /**
   * Show a popover near an element. Minimal — no framework dependency.
   */
  function showPopover(trigger, title, text) {
    // Remove existing
    var existing = document.getElementById('gl-help-popover');
    if (existing) { existing.remove(); return; }

    var pop = document.createElement('div');
    pop.id = 'gl-help-popover';
    pop.style.cssText = 'position:fixed;z-index:100000;max-width:280px;background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,0.5);font-size:0.82em;color:#e2e8f0;line-height:1.5';
    pop.innerHTML = '<div style="font-weight:700;color:#818cf8;margin-bottom:4px">' + title + '</div>'
      + '<div>' + text + '</div>'
      + '<button onclick="this.parentElement.remove()" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#64748b;cursor:pointer;font-size:1em">✕</button>';
    document.body.appendChild(pop);

    // Position near trigger
    var rect = trigger.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left - popRect.width / 2 + rect.width / 2;
    if (left < 8) left = 8;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 6;
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';

    // Dismiss on outside click
    setTimeout(function () {
      document.addEventListener('click', function _dismiss(e) {
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', _dismiss); }
      });
    }, 50);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.glInlineHelp = {
    getExplainer: getExplainer,
    getEmptyState: getEmptyState,
    getRecordingSetup: getRecordingSetup,
    getRecordingTip: getRecordingTip,
    getNextSteps: getNextSteps,
    renderNextStepBanner: renderNextStepBanner,
    renderHelpTrigger: renderHelpTrigger,
    showPopover: showPopover,
    EXPLAINERS: EXPLAINERS,
    EMPTY_STATES: EMPTY_STATES,
    RECORDING_SETUP: RECORDING_SETUP,
    NEXT_STEPS: NEXT_STEPS,
  };

  console.log('✅ glInlineHelp loaded');

})();
