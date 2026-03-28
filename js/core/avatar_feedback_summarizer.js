/**
 * avatar_feedback_summarizer.js — AI Summary Hook for Feedback Reports
 *
 * Local-first: generates a title/summary without Claude.
 * Optionally enriches via Claude when available.
 * Submission NEVER depends on Claude availability.
 *
 * EXPOSES: window.GLFeedbackSummarizer
 */

(function() {
  'use strict';

  /**
   * Generate a local summary (no API needed).
   */
  function localSummary(payload) {
    var title = payload.title || '';
    var summary = payload.summary || payload.userMessageRaw || '';
    var tags = [];

    // Auto-tag based on context
    if (payload.context) {
      if (payload.context.currentPage) tags.push('page:' + payload.context.currentPage);
      if (payload.context.onboardingStep > 0) tags.push('onboarding');
      if (payload.context.device && payload.context.device.isPWA) tags.push('pwa');
      if (payload.context.recentErrors && payload.context.recentErrors.length) tags.push('has-errors');
    }
    if (payload.auto) tags.push('auto-detected');

    return { title: title, summary: summary, tags: tags, productArea: _guessProductArea(payload) };
  }

  /**
   * Optionally enrich via Claude (non-blocking, fire-and-forget).
   */
  async function enrichWithClaude(payload) {
    if (typeof workerApi === 'undefined' || !workerApi || !workerApi.claude) return null;

    try {
      var prompt = 'Summarize this product feedback in JSON: { "title": "short title", "summary": "1-2 sentences", "tags": ["tag1"], "productArea": "area", "probableCause": "likely reason" }\n\n'
        + 'Type: ' + payload.type + '\n'
        + 'User said: ' + (payload.userMessageRaw || payload.summary) + '\n'
        + 'Page: ' + (payload.context ? payload.context.currentPage : '') + '\n'
        + 'Auto: ' + payload.auto;

      var response = await workerApi.claude(
        'You are a product analyst. Return ONLY valid JSON. Be concise.',
        prompt,
        150
      );

      try {
        var parsed = JSON.parse(response);
        return parsed;
      } catch(e) {
        return null;
      }
    } catch(e) {
      return null;
    }
  }

  function _guessProductArea(payload) {
    var page = (payload.context && payload.context.currentPage) || '';
    var areas = {
      home: 'dashboard', songs: 'song-library', setlists: 'setlists', rehearsal: 'rehearsal',
      gigs: 'gigs', calendar: 'calendar', admin: 'settings', feed: 'band-feed',
      practice: 'practice', 'rehearsal-mode': 'rehearsal-mode'
    };
    return areas[page] || 'general';
  }

  window.GLFeedbackSummarizer = {
    localSummary: localSummary,
    enrichWithClaude: enrichWithClaude
  };

  console.log('\uD83E\uDDE0 GLFeedbackSummarizer loaded');
})();
