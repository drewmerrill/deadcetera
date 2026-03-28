/**
 * groovemate_hint_engine.js — Contextual Hint Engine
 *
 * 3 hint types only: unlock, rescue, optimization.
 * Context-aware, behavior-aware, infrequent, relevant.
 *
 * EXPOSES: window.GLHintEngine
 */

(function() {
  'use strict';

  var _shownThisSession = {};
  var _MAX_HINTS_PER_SESSION = 3;
  var _hintCount = 0;

  // ── Hint Definitions ────────────────────────────────────────────────────

  var HINTS = [
    // Rescue hints — user is stuck
    { id: 'empty_library_rescue', type: 'rescue', page: 'songs',
      condition: function() { return (typeof allSongs !== 'undefined') && allSongs.length === 0; },
      text: 'Your library is empty. Try saying "import Billy Joel" or type songs in the setlist editor.',
      action: 'import_artist_pack' },

    { id: 'no_setlists_rescue', type: 'rescue', page: 'setlists',
      condition: function() { try { return !(window._cachedSetlists && window._cachedSetlists.length); } catch(e) { return false; } },
      text: 'No setlists yet. Create one — or I can build a starter set for you.',
      action: 'create_setlist' },

    { id: 'onboarding_stuck', type: 'rescue', page: 'home',
      condition: function() { return (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep && GLAvatarGuide.getOnboardStep() === 1); },
      text: 'Start by creating a setlist. Just pick a few songs — you can always change them.',
      action: 'create_setlist' },

    // Unlock hints — user hasn't discovered a feature
    { id: 'no_chart_source', type: 'unlock', page: 'songs',
      condition: function() { return true; }, // show once per session on songs page
      text: 'You can attach chart links (Ultimate Guitar, Chordify, etc.) to any song. Say "attach [URL] for [song]".',
      action: null },

    { id: 'no_sections', type: 'unlock', page: 'songs',
      condition: function() { return true; },
      text: 'Add song sections (Intro, Verse, Chorus...) to make rehearsal plans smarter.',
      action: 'update_chart_sections' },

    { id: 'voice_input_unlock', type: 'unlock', page: 'any',
      condition: function() { return !localStorage.getItem('gl_hint_voice_shown'); },
      text: 'Tap the mic button to talk to me instead of typing.',
      action: null },

    // Optimization hints — user could do more
    { id: 'many_songs_no_readiness', type: 'optimization', page: 'songs',
      condition: function() {
        try { return (typeof allSongs !== 'undefined') && allSongs.length > 10 && Object.keys(typeof readinessCache !== 'undefined' ? readinessCache : {}).length < 3; } catch(e) { return false; }
      },
      text: 'Set readiness levels on your songs so I can suggest what to focus on in rehearsal.',
      action: null }
  ];

  // ── Get Hint for Current Context ────────────────────────────────────────

  function getHint(currentPage) {
    if (_hintCount >= _MAX_HINTS_PER_SESSION) return null;

    for (var i = 0; i < HINTS.length; i++) {
      var h = HINTS[i];
      if (_shownThisSession[h.id]) continue;
      if (h.page !== 'any' && h.page !== currentPage) continue;

      try {
        if (h.condition && h.condition()) {
          _shownThisSession[h.id] = true;
          _hintCount++;
          if (h.id === 'voice_input_unlock') localStorage.setItem('gl_hint_voice_shown', '1');
          return { id: h.id, type: h.type, text: h.text, action: h.action };
        }
      } catch(e) {}
    }

    return null;
  }

  window.GLHintEngine = {
    getHint: getHint
  };

  console.log('\uD83D\uDCA1 GLHintEngine loaded');
})();
