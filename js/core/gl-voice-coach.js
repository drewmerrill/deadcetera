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

  // ── ElevenLabs Voice ID (warm conversational) ──────────────────────────
  // Rachel = warm, conversational female. Change ID for different voice.
  var _ELEVENLABS_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Rachel
  var _ELEVENLABS_MODEL = 'eleven_turbo_v2_5';

  // Tone → voice settings mapping
  var _TONE_SETTINGS = {
    calm:      { stability: 0.6, similarity: 0.8, style: 0.3, speed: 0.95 },
    energetic: { stability: 0.4, similarity: 0.75, style: 0.6, speed: 1.1 },
    neutral:   { stability: 0.5, similarity: 0.8, style: 0.4, speed: 1.0 }
  };

  // ── Text-to-Speech — ElevenLabs with Web Speech fallback ──────────────

  function speak(text, opts) {
    if (!_voiceEnabled || !text) return;
    opts = opts || {};
    var tone = opts.tone || 'neutral';

    // Try ElevenLabs first
    if (typeof workerApi !== 'undefined' && workerApi) {
      _speakElevenLabs(text, tone);
    } else {
      _speakWebSpeech(text, opts);
    }
  }

  function _speakElevenLabs(text, tone) {
    var settings = _TONE_SETTINGS[tone] || _TONE_SETTINGS.neutral;
    var url = 'https://api.elevenlabs.io/v1/text-to-speech/' + _ELEVENLABS_VOICE;

    // Check for API key in localStorage (set by user in settings)
    var apiKey = localStorage.getItem('gl_elevenlabs_key') || '';
    if (!apiKey) {
      // No ElevenLabs key — fall back to Web Speech
      _speakWebSpeech(text, { rate: settings.speed });
      return;
    }

    _speaking = true;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: text,
        model_id: _ELEVENLABS_MODEL,
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity,
          style: settings.style,
          use_speaker_boost: true
        }
      })
    }).then(function(res) {
      if (!res.ok) throw new Error('ElevenLabs ' + res.status);
      return res.blob();
    }).then(function(blob) {
      var audio = new Audio(URL.createObjectURL(blob));
      audio.onended = function() { _speaking = false; URL.revokeObjectURL(audio.src); };
      audio.onerror = function() { _speaking = false; };
      audio.play();
    }).catch(function(e) {
      console.warn('[VoiceCoach] ElevenLabs failed, using Web Speech:', e.message);
      _speaking = false;
      _speakWebSpeech(text, { rate: (_TONE_SETTINGS[tone] || {}).speed || 1.0 });
    });
  }

  function _speakWebSpeech(text, opts) {
    if (!window.speechSynthesis) return;
    opts = opts || {};
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = opts.rate || 1.05;
    utterance.pitch = opts.pitch || 1.0;
    utterance.volume = opts.volume || 0.85;
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
      text += '... Next time, ' + insight.narrative.nextAction;
    }
    var words = text.split(' ');
    if (words.length > 40) text = words.slice(0, 40).join(' ') + '...';
    // Determine tone from insight content
    var tone = 'neutral';
    if (insight.confidence && insight.confidence > 0.7) tone = 'energetic';
    if (text.indexOf('needs work') >= 0 || text.indexOf('regression') >= 0) tone = 'calm';
    speak(text, { tone: tone });
  }

  // ── Speak Onboarding Step ──────────────────────────────────────────────

  function speakOnboardingStep(step) {
    var _pickOne = function(arr) { return arr[Math.floor(Math.random() * arr.length)]; };
    var messages = {
      1: _pickOne(['Hey, let\u2019s get your songs in.', 'First up... pick some songs.', 'Alright, let\u2019s build your set.']),
      2: _pickOne(['Songs are in. Let\u2019s run through \u2019em.', 'Ready to rehearse? One tap.', 'Set\u2019s ready. Let\u2019s fire it up.']),
      3: _pickOne(['How\u2019d it feel? Quick rating.', 'Almost done... just rate it.', 'Last step \u2014 was it solid?'])
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
    var base = 'You are GrooveMate, a band\'s extra bandmate inside the GrooveLinx app. ';
    base += 'Talk like a musician, not a system. Use contractions. Keep it under 3 sentences. ';
    base += 'Reference specific songs, times, and data when you have it. ';
    base += 'Never be generic or corporate. No "great job" without evidence. ';
    base += 'Use "..." for natural pauses. Be real. ';

    if (stage === 'coach') {
      return base + 'You\'ve been with this band a while. Be direct and prescriptive. Tell them exactly what to do. Challenge them \u2014 they trust you.';
    }
    if (stage === 'bandmate') {
      return base + 'You know the band well. Be honest but supportive. Share what you notice. Suggest one clear thing to focus on.';
    }
    return base + 'This band is new. Be warm and encouraging. Keep instructions simple. One thing at a time.';
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
      var _api = (typeof workerApi !== 'undefined') ? workerApi : (typeof workerAPI !== 'undefined') ? workerAPI : null;
      if (!_api || !_api.claude) {
        return 'Voice coach is not available right now. Please try again later.';
      }
      var response = await _api.claude(systemPrompt, userPrompt, 200);
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
