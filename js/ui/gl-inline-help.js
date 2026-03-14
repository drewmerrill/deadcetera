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
      text: 'Songs ranked by how much rehearsal attention they need. The score combines readiness deficit, practice recency, upcoming gig exposure, and member variance. Higher score = more urgent.',
    },

    // Practice Attention
    'practice-attention': {
      title: 'Practice Attention Score',
      text: 'A composite score showing how much this song needs rehearsal right now. Based on band readiness, how recently it was practiced, whether it\'s on an upcoming setlist, and member score gaps.',
    },

    // Now Playing
    'now-playing': {
      title: 'Now Playing',
      text: 'The song you\'re currently focused on. This persists across pages — it\'s your working context. Set it from any song detail panel. Clear it with the ✕ button.',
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
    renderHelpTrigger: renderHelpTrigger,
    showPopover: showPopover,
    EXPLAINERS: EXPLAINERS,
    EMPTY_STATES: EMPTY_STATES,
    RECORDING_SETUP: RECORDING_SETUP,
  };

  console.log('✅ glInlineHelp loaded');

})();
