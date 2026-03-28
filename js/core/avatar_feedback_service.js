/**
 * avatar_feedback_service.js — Centralized Feedback Submission + Auto-Friction Detection
 *
 * Handles both explicit user reports and automatic friction events.
 * Stores to Firebase /product_feedback/{reportId} + mirrors to band path.
 *
 * EXPOSES: window.GLFeedbackService
 */

(function() {
  'use strict';

  // Auto-friction scoring
  var _frictionScore = 0;
  var _autoSubmittedThisSession = {};
  var _autoSubmitsToday = 0;
  var _MAX_AUTO_PER_DAY = 5;
  var _AUTO_THRESHOLD = 3;
  var _AUTO_DEDUP_KEY_PREFIX = 'gl_fb_dedup_';

  // Friction event weights
  var FRICTION_WEIGHTS = {
    hesitation: 1,
    repeated_failure: 2,
    abandonment: 2,
    explicit_confusion: 2,
    render_error: 4,
    repeated_no_results: 1,
    save_failure: 2
  };

  /**
   * Submit explicit feedback from user via avatar.
   */
  async function submitExplicit(userMessage) {
    if (!userMessage || !userMessage.trim()) return null;

    var context = (typeof GLFeedbackContext !== 'undefined') ? GLFeedbackContext.collect() : { reportId: 'fb_' + Date.now() };
    var classification = (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.classify(userMessage) : { type: 'other', severity: 'medium' };

    var title = _generateTitle(userMessage, classification.type);

    var payload = {
      reportId: context.reportId,
      createdAt: context.timestamp || new Date().toISOString(),
      status: 'new',
      source: 'avatar',
      auto: false,
      type: classification.type,
      severity: classification.severity,
      title: title,
      summary: userMessage.substring(0, 300),
      userMessageRaw: userMessage,
      context: context,
      tags: [],
      assignedTo: '',
      resolutionNotes: ''
    };

    await _save(payload);
    return payload;
  }

  /**
   * Record a friction event. Auto-submits when threshold is reached.
   */
  function recordFriction(eventType, detail) {
    var weight = FRICTION_WEIGHTS[eventType] || 1;
    _frictionScore += weight;

    // Track the action
    if (typeof GLFeedbackContext !== 'undefined') {
      GLFeedbackContext.trackAction('friction:' + eventType, detail || '');
    }

    // Check threshold
    if (_frictionScore >= _AUTO_THRESHOLD) {
      _maybeAutoSubmit(eventType, detail);
      _frictionScore = 0; // Reset after submission attempt
    }
  }

  async function _maybeAutoSubmit(triggerEvent, detail) {
    // Dedupe: same event type only once per session
    var dedupKey = triggerEvent + '_' + ((typeof currentPage !== 'undefined') ? currentPage : '');
    if (_autoSubmittedThisSession[dedupKey]) return;

    // Daily cap
    if (_autoSubmitsToday >= _MAX_AUTO_PER_DAY) return;

    // Session dedupe via localStorage (don't repeat within 1 hour)
    var lsKey = _AUTO_DEDUP_KEY_PREFIX + dedupKey;
    var lastSubmit = parseInt(localStorage.getItem(lsKey) || '0');
    if (Date.now() - lastSubmit < 3600000) return;

    _autoSubmittedThisSession[dedupKey] = true;
    _autoSubmitsToday++;
    localStorage.setItem(lsKey, Date.now().toString());

    var context = (typeof GLFeedbackContext !== 'undefined') ? GLFeedbackContext.collect() : { reportId: 'fb_' + Date.now() };
    var hasRenderError = context.recentErrors && context.recentErrors.length > 0;

    var autoContext = { auto: true, autoType: _mapFrictionToType(triggerEvent), hasRenderError: hasRenderError };
    var classification = (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.classify(detail || triggerEvent, autoContext) : { type: 'other', severity: 'low' };

    var summary = 'Auto-detected: ' + triggerEvent + (detail ? ' — ' + detail : '') + ' on page: ' + (context.currentPage || 'unknown');

    var payload = {
      reportId: context.reportId,
      createdAt: context.timestamp || new Date().toISOString(),
      status: 'new',
      source: 'avatar',
      auto: true,
      type: classification.type,
      severity: classification.severity,
      title: 'Auto: ' + triggerEvent.replace(/_/g, ' '),
      summary: summary,
      userMessageRaw: '',
      context: context,
      tags: ['auto-detected'],
      assignedTo: '',
      resolutionNotes: ''
    };

    await _save(payload);
    console.log('[Feedback] Auto-submitted:', triggerEvent, 'on', context.currentPage);
  }

  function _mapFrictionToType(event) {
    var map = {
      hesitation: 'ux_confusion',
      repeated_failure: 'bug',
      abandonment: 'onboarding_friction',
      explicit_confusion: 'ux_confusion',
      render_error: 'bug',
      repeated_no_results: 'ux_confusion',
      save_failure: 'bug'
    };
    return map[event] || 'other';
  }

  function _generateTitle(message, type) {
    var typeLabels = { bug: 'Bug', ux_confusion: 'UX Issue', feature_request: 'Feature Request', copy_issue: 'Copy Issue', performance_issue: 'Performance', data_issue: 'Data Issue', onboarding_friction: 'Onboarding', praise: 'Praise' };
    var label = typeLabels[type] || 'Feedback';
    var short = message.substring(0, 60);
    if (message.length > 60) short += '...';
    return label + ': ' + short;
  }

  /**
   * Save to Firebase — primary + band mirror.
   */
  async function _save(payload) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) {
      console.warn('[Feedback] No Firebase — storing locally');
      _saveLocal(payload);
      return;
    }

    try {
      // Primary: /product_feedback/{reportId}
      await db.ref('product_feedback/' + payload.reportId).set(payload);

      // Mirror to band path
      if (payload.context && payload.context.bandId) {
        await db.ref('bands/' + payload.context.bandId + '/feedback_reports/' + payload.reportId).set({
          reportId: payload.reportId,
          type: payload.type,
          severity: payload.severity,
          title: payload.title,
          status: payload.status,
          auto: payload.auto,
          createdAt: payload.createdAt
        });
      }
    } catch(e) {
      console.error('[Feedback] Save failed:', e.message);
      _saveLocal(payload);
    }
  }

  function _saveLocal(payload) {
    try {
      var local = JSON.parse(localStorage.getItem('gl_pending_feedback') || '[]');
      local.push(payload);
      localStorage.setItem('gl_pending_feedback', JSON.stringify(local));
    } catch(e) {}
  }

  /**
   * GLStore-compatible API for admin inbox.
   */
  async function listProductFeedback() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) return [];
    try {
      var snap = await db.ref('product_feedback').orderByChild('createdAt').limitToLast(100).once('value');
      var data = snap.val();
      if (!data) return [];
      return Object.values(data).sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    } catch(e) { return []; }
  }

  async function updateFeedbackStatus(reportId, patch) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || !reportId) return;
    try {
      await db.ref('product_feedback/' + reportId).update(patch);
    } catch(e) { console.error('[Feedback] Update failed:', e.message); }
  }

  // Wire into existing friction detection systems
  window.addEventListener('gl:pagechange', function() { _frictionScore = 0; }); // Reset on nav

  window.GLFeedbackService = {
    submitExplicit: submitExplicit,
    recordFriction: recordFriction,
    listProductFeedback: listProductFeedback,
    updateFeedbackStatus: updateFeedbackStatus
  };

  console.log('\uD83D\uDCE8 GLFeedbackService loaded');
})();
