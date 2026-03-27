/**
 * gl-voice-coach.js — Avatar Voice Coach
 *
 * Text-to-speech for insights + ask-anything via Claude API.
 * Uses Web Speech API for TTS and Cloudflare Worker for Claude proxy.
 *
 * DEPENDS ON: gl-avatar-guide.js, groovelinx_product_brain.js, worker-api.js
 * LOAD ORDER: after groovelinx_store.js
 */

(function() {
  'use strict';

  var _speaking = false;
  var _voiceEnabled = localStorage.getItem('gl_voice_enabled') !== 'false'; // default ON
  var _lastResponse = null;

  // ── Text-to-Speech ──────────────────────────────────────────────────────

  function speak(text, opts) {
    if (!_voiceEnabled || !text || !window.speechSynthesis) return;
    opts = opts || {};
    // Cancel any current speech
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts.rate || 1.05; // slightly fast — feels confident
    utterance.pitch = opts.pitch || 1.0;
    utterance.volume = opts.volume || 0.85;
    // Prefer a natural voice
    var voices = window.speechSynthesis.getVoices();
    var preferred = voices.find(function(v) { return v.name.indexOf('Samantha') >= 0 || v.name.indexOf('Google') >= 0 || v.name.indexOf('Natural') >= 0; });
    if (preferred) utterance.voice = preferred;
    utterance.onstart = function() { _speaking = true; };
    utterance.onend = function() { _speaking = false; };
    utterance.onerror = function() { _speaking = false; };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    _speaking = false;
  }

  function toggleVoice() {
    _voiceEnabled = !_voiceEnabled;
    localStorage.setItem('gl_voice_enabled', _voiceEnabled ? 'true' : 'false');
    if (!_voiceEnabled) stopSpeaking();
    return _voiceEnabled;
  }

  // ── Speak Insight (after Reveal) ────────────────────────────────────────

  function speakInsight(insight) {
    if (!insight || insight._empty) return;
    var text = insight.headline || '';
    if (insight.narrative && insight.narrative.nextAction) {
      text += '. Next time: ' + insight.narrative.nextAction;
    }
    // Keep it under 15 seconds of speech (~40 words)
    var words = text.split(' ');
    if (words.length > 40) text = words.slice(0, 40).join(' ') + '...';
    speak(text);
  }

  // ── Speak Onboarding Step ──────────────────────────────────────────────

  function speakOnboardingStep(step) {
    var messages = {
      1: 'Step one. Pick the songs you are playing.',
      2: 'Setlist ready. Let\'s rehearse it.',
      3: 'How did it go? One tap to confirm.'
    };
    if (messages[step]) speak(messages[step]);
  }

  // ── Build Context for Claude ──────────────────────────────────────────

  function _buildContext() {
    var ctx = {};
    // Band
    ctx.band = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'unknown';
    ctx.bandName = localStorage.getItem('deadcetera_band_name') || ctx.band;
    // Members
    ctx.memberCount = (typeof bandMembers !== 'undefined') ? Object.keys(bandMembers).length : 0;
    ctx.members = (typeof bandMembers !== 'undefined') ? Object.keys(bandMembers).map(function(k) {
      return bandMembers[k].name + ' (' + (bandMembers[k].role || 'Member') + ')';
    }).join(', ') : '';
    // Current page
    ctx.currentPage = (typeof currentPage !== 'undefined') ? currentPage : 'home';
    // Rehearsal insight
    if (typeof GLProductBrain !== 'undefined') {
      var insight = GLProductBrain.getInsightFromSession('latest');
      if (insight && !insight._empty) {
        ctx.lastRehearsalHeadline = insight.headline;
        ctx.lastRehearsalIssue = insight.narrative ? insight.narrative.biggestIssue : '';
        ctx.lastRehearsalNextAction = insight.narrative ? insight.narrative.nextAction : '';
        ctx.lastRehearsalMinutes = insight.coaching ? insight.coaching.totalMinutes : 0;
      }
    }
    // Stage
    if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getStage) {
      ctx.stage = GLAvatarGuide.getStage();
    }
    // Songs count
    ctx.songCount = (typeof allSongs !== 'undefined') ? allSongs.length : 0;
    return ctx;
  }

  // ── Stage-Based System Prompt ─────────────────────────────────────────

  function _getSystemPrompt(stage) {
    var base = 'You are GrooveMate, a band rehearsal coach inside the GrooveLinx app. ';
    base += 'Keep responses under 3 sentences. Be specific, actionable, and direct. ';
    base += 'Reference real song names, restarts, and time data when available. ';
    base += 'Never be generic. Never say "great job" without evidence. ';

    if (stage === 'coach') {
      return base + 'You are in Coach mode — be prescriptive and confident. Give specific instructions. Challenge the band to improve. You have earned their trust.';
    }
    if (stage === 'bandmate') {
      return base + 'You are in Bandmate mode — be supportive but honest. Share observations. Suggest focus areas. You know the band well.';
    }
    return base + 'You are in Fan mode — be encouraging and helpful. Guide the band through basics. Keep it simple and positive.';
  }

  // ── Ask Anything ──────────────────────────────────────────────────────

  async function ask(question) {
    if (!question || !question.trim()) return 'Ask me anything about your rehearsals, songs, or what to work on next.';

    var ctx = _buildContext();
    var stage = ctx.stage || 'fan';
    var systemPrompt = _getSystemPrompt(stage);

    // Build context summary for Claude
    var contextBlock = 'Band: ' + ctx.bandName + ' (' + ctx.memberCount + ' members: ' + ctx.members + '). ';
    contextBlock += 'Song catalog: ' + ctx.songCount + ' songs. ';
    if (ctx.lastRehearsalHeadline) {
      contextBlock += 'Last rehearsal: ' + ctx.lastRehearsalHeadline + '. ';
      if (ctx.lastRehearsalIssue) contextBlock += 'Biggest issue: ' + ctx.lastRehearsalIssue + '. ';
      if (ctx.lastRehearsalNextAction) contextBlock += 'Next action: ' + ctx.lastRehearsalNextAction + '. ';
    }
    contextBlock += 'User is currently on the ' + ctx.currentPage + ' page.';

    var userPrompt = 'Context: ' + contextBlock + '\n\nUser asks: ' + question.trim();

    try {
      if (typeof workerAPI === 'undefined' || !workerAPI.claude) {
        return 'Voice coach requires an internet connection.';
      }
      var response = await workerAPI.claude(systemPrompt, userPrompt, 200);
      _lastResponse = response;
      return response;
    } catch(e) {
      console.error('[VoiceCoach] Claude error:', e);
      // Fallback: use Product Brain data directly
      if (ctx.lastRehearsalHeadline) {
        return ctx.lastRehearsalHeadline + (ctx.lastRehearsalNextAction ? ' ' + ctx.lastRehearsalNextAction : '');
      }
      return 'I couldn\'t reach the server. Check your connection and try again.';
    }
  }

  // ── Ask and Speak ─────────────────────────────────────────────────────

  async function askAndSpeak(question) {
    var response = await ask(question);
    speak(response);
    return response;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.GLVoiceCoach = {
    speak: speak,
    stopSpeaking: stopSpeaking,
    toggleVoice: toggleVoice,
    isVoiceEnabled: function() { return _voiceEnabled; },
    isSpeaking: function() { return _speaking; },
    speakInsight: speakInsight,
    speakOnboardingStep: speakOnboardingStep,
    ask: ask,
    askAndSpeak: askAndSpeak,
    getLastResponse: function() { return _lastResponse; }
  };

  console.log('\uD83C\uDF99 GLVoiceCoach loaded');
})();
