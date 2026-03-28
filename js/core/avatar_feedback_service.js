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

  // Auto-capture: max 1 per type per session, only 3 triggers
  var _autoSubmittedThisSession = {};
  var _failureCounts = {}; // track repeated failures per action

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
   * Record a friction event. Auto-submits only for 3 specific triggers:
   * 1. Render failure (immediate)
   * 2. Same action fails 3x
   * 3. Onboarding stall (>20s no progress)
   * Max 1 auto-report per type per session.
   */
  function recordFriction(eventType, detail) {
    if (typeof GLFeedbackContext !== 'undefined') {
      GLFeedbackContext.trackAction('friction:' + eventType, detail || '');
    }

    if (eventType === 'render_error') {
      _autoSubmit('render_error', 'bug', 'high', detail);
    } else if (eventType === 'repeated_failure') {
      var key = detail || 'unknown_action';
      _failureCounts[key] = (_failureCounts[key] || 0) + 1;
      if (_failureCounts[key] >= 3) {
        _autoSubmit('repeated_failure', 'bug', 'medium', key + ' failed 3x');
        _failureCounts[key] = 0;
      }
    } else if (eventType === 'onboarding_stall') {
      _autoSubmit('onboarding_stall', 'onboarding_friction', 'medium', detail);
    }
  }

  function _autoSubmit(trigger, type, severity, detail) {
    // Dedupe: max 1 per type per session
    if (_autoSubmittedThisSession[trigger]) return;
    _autoSubmittedThisSession[trigger] = true;

    var context = (typeof GLFeedbackContext !== 'undefined') ? GLFeedbackContext.collect() : { reportId: 'fb_' + Date.now() };

    var payload = {
      reportId: context.reportId,
      createdAt: context.timestamp || new Date().toISOString(),
      status: 'new',
      source: 'avatar',
      auto: true,
      type: type,
      severity: severity,
      title: 'Auto: ' + trigger.replace(/_/g, ' '),
      summary: 'Auto-detected: ' + (detail || trigger) + ' on page: ' + (context.currentPage || 'unknown'),
      userMessageRaw: '',
      context: context
    };

    _save(payload);
    console.log('[Feedback] Auto-submitted:', trigger, 'on', context.currentPage);
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
