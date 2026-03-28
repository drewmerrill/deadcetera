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
    var page = context.currentPage || '';
    var classification = (typeof GLFeedbackClassifier !== 'undefined')
      ? GLFeedbackClassifier.classify(userMessage, { page: page })
      : { type: 'other', severity: 'medium', keyword: 'general', clusterKey: 'other_unknown_general' };

    var isFounder = _checkFounder();
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
      clusterKey: classification.clusterKey || '',
      keyword: classification.keyword || '',
      founder: isFounder,
      score: (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.scoreIssue(classification.type, page, 1, isFounder) : 1,
      tags: isFounder ? ['founder'] : [],
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

    var page = context.currentPage || '';
    var isFounder = _checkFounder();
    var keyword = (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.getPrimaryKeyword(detail || trigger) : 'general';
    var clusterKey = type + '_' + (page || 'unknown') + '_' + keyword;

    var payload = {
      reportId: context.reportId,
      createdAt: context.timestamp || new Date().toISOString(),
      status: 'new',
      source: 'avatar',
      auto: true,
      type: type,
      severity: severity,
      title: 'Auto: ' + trigger.replace(/_/g, ' '),
      summary: 'Auto-detected: ' + (detail || trigger) + ' on page: ' + (page || 'unknown'),
      userMessageRaw: '',
      context: context,
      clusterKey: clusterKey,
      keyword: keyword,
      founder: isFounder,
      score: (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.scoreIssue(type, page, 1, isFounder) : 1,
      tags: isFounder ? ['founder', 'auto-detected'] : ['auto-detected']
    };

    _save(payload);
    console.log('[Feedback] Auto-submitted:', trigger, 'on', page);
  }

  // ── Founder Detection ──────────────────────────────────────────────────

  function _checkFounder() {
    try {
      if (typeof GLPlans !== 'undefined' && GLPlans.getCurrentPlan) {
        return GLPlans.getCurrentPlan() === 'founder';
      }
      var plan = localStorage.getItem('gl_plan');
      return plan === 'founder';
    } catch(e) { return false; }
  }

  // ── Flow Break Detection ───────────────────────────────────────────────

  var _activeFlows = {};
  var _flowBreakSubmitted = {};

  function startFlow(flowId) {
    _activeFlows[flowId] = { started: Date.now(), step: 0 };
  }

  function advanceFlow(flowId) {
    if (_activeFlows[flowId]) _activeFlows[flowId].step++;
  }

  function completeFlow(flowId) {
    delete _activeFlows[flowId];
  }

  function _checkFlowBreaks() {
    var now = Date.now();
    Object.keys(_activeFlows).forEach(function(flowId) {
      var flow = _activeFlows[flowId];
      var elapsed = now - flow.started;
      // Flow break: started > 60s ago, never completed
      if (elapsed > 60000 && !_flowBreakSubmitted[flowId]) {
        _flowBreakSubmitted[flowId] = true;
        var context = (typeof GLFeedbackContext !== 'undefined') ? GLFeedbackContext.collect() : { reportId: 'fb_' + Date.now() };
        var page = context.currentPage || '';
        var isFounder = _checkFounder();

        _save({
          reportId: context.reportId,
          createdAt: new Date().toISOString(),
          status: 'new',
          source: 'avatar',
          auto: true,
          type: 'flow_break',
          severity: 'medium',
          title: 'Flow break: ' + flowId + ' (step ' + flow.step + ')',
          summary: 'User started ' + flowId + ' but did not complete. Spent ' + Math.round(elapsed / 1000) + 's, reached step ' + flow.step + '.',
          userMessageRaw: '',
          context: context,
          clusterKey: 'flow_break_' + flowId + '_step' + flow.step,
          keyword: flowId,
          founder: isFounder,
          score: (typeof GLFeedbackClassifier !== 'undefined') ? GLFeedbackClassifier.scoreIssue('flow_break', page, 1, isFounder) : 3,
          tags: isFounder ? ['founder', 'flow-break'] : ['flow-break'],
          flowData: { flowId: flowId, step: flow.step, timeSpentSec: Math.round(elapsed / 1000) }
        });
        delete _activeFlows[flowId];
        console.log('[Feedback] Flow break:', flowId, 'step', flow.step);
      }
    });
  }

  // Check flow breaks every 30s
  setInterval(_checkFlowBreaks, 30000);
  // Also check on page change
  window.addEventListener('gl:pagechange', function() {
    setTimeout(_checkFlowBreaks, 2000);
  });

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
    updateFeedbackStatus: updateFeedbackStatus,
    startFlow: startFlow,
    advanceFlow: advanceFlow,
    completeFlow: completeFlow
  };

  console.log('\uD83D\uDCE8 GLFeedbackService loaded');
})();
