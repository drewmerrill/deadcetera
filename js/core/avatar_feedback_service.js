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

  // ── Root Cause Analysis (non-blocking Claude call) ──────────────────────

  async function generateClusterInsight(clusterKey, reports) {
    if (!reports || reports.length < 1) return null;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;

    // Build local summary first (always available)
    var topMessages = reports.slice(0, 5).map(function(r) { return (r.userMessageRaw || r.summary || '').substring(0, 100); }).filter(Boolean);
    var page = (reports[0].context && reports[0].context.currentPage) || '';
    var localInsight = {
      summary: reports[0].title || clusterKey,
      suspectedCause: 'Multiple users reported issues with ' + (reports[0].keyword || 'this feature') + ' on ' + (page || 'this page'),
      recommendedFix: 'Review ' + (page || 'page') + ' — ' + (reports[0].keyword || 'area') + ' flow needs attention',
      generatedAt: new Date().toISOString(),
      reportCount: reports.length
    };

    // Try Claude enrichment (non-blocking)
    if (typeof workerApi !== 'undefined' && workerApi && workerApi.claude && topMessages.length > 0) {
      try {
        var prompt = 'Analyze these user feedback reports and return JSON:\n'
          + '{ "summary": "1-line issue summary", "suspectedCause": "likely root cause", "recommendedFix": "specific fix suggestion" }\n\n'
          + 'Page: ' + page + '\nType: ' + reports[0].type + '\nReports:\n' + topMessages.join('\n');
        var response = await workerApi.claude('You are a product analyst. Return ONLY valid JSON. Be specific and concise.', prompt, 150);
        try {
          var parsed = JSON.parse(response);
          localInsight.summary = parsed.summary || localInsight.summary;
          localInsight.suspectedCause = parsed.suspectedCause || localInsight.suspectedCause;
          localInsight.recommendedFix = parsed.recommendedFix || localInsight.recommendedFix;
          localInsight.aiEnriched = true;
        } catch(e) {}
      } catch(e) {}
    }

    // Store to Firebase
    if (db) {
      try { await db.ref('feedback_clusters/' + clusterKey.replace(/[.#$/\[\]]/g, '_')).set(localInsight); } catch(e) {}
    }
    return localInsight;
  }

  // ── Action Generation ──────────────────────────────────────────────────

  async function createAction(clusterKey, actionType, reports) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || !reports || !reports.length) return null;

    var r = reports[0];
    var page = (r.context && r.context.currentPage) || '';
    var id = 'action_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);

    var action = {
      id: id,
      createdAt: new Date().toISOString(),
      clusterKey: clusterKey,
      actionType: actionType, // 'bug', 'ux_fix', 'feature'
      title: (actionType === 'bug' ? 'Fix: ' : actionType === 'feature' ? 'Feature: ' : 'UX Fix: ') + (r.keyword || 'issue') + ' on ' + page,
      description: r.title + ' (' + reports.length + ' reports)',
      stepsToReproduce: 'Go to ' + page + ' page. ' + (r.userMessageRaw || r.summary || '').substring(0, 200),
      impact: reports.length + ' users affected. Score: ' + (r.score || 0),
      priority: r.severity || 'medium',
      status: 'open',
      reportCount: reports.length,
      countAtCreation: reports.length
    };

    try { await db.ref('product_actions/' + id).set(action); } catch(e) {}
    return action;
  }

  // ── Fix Verification ───────────────────────────────────────────────────

  async function getClusterTrend(clusterKey, reports) {
    if (!reports || reports.length < 2) return 'new';
    var now = Date.now();
    var d24h = 86400000;
    var recent = reports.filter(function(r) { return (now - new Date(r.createdAt).getTime()) < d24h; }).length;
    var older = reports.filter(function(r) { var t = now - new Date(r.createdAt).getTime(); return t >= d24h && t < d24h * 2; }).length;
    if (recent < older) return 'improving';
    if (recent > older) return 'worse';
    return 'same';
  }

  // Wire into existing friction detection systems
  window.addEventListener('gl:pagechange', function() {}); // Keep event listener

  window.GLFeedbackService = {
    submitExplicit: submitExplicit,
    recordFriction: recordFriction,
    listProductFeedback: listProductFeedback,
    updateFeedbackStatus: updateFeedbackStatus,
    generateClusterInsight: generateClusterInsight,
    createAction: createAction,
    getClusterTrend: getClusterTrend,
    startFlow: startFlow,
    advanceFlow: advanceFlow,
    completeFlow: completeFlow
  };

  console.log('\uD83D\uDCE8 GLFeedbackService loaded');
})();
