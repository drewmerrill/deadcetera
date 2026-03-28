/**
 * avatar_feedback_classifier.js — Lightweight Rule-Based Feedback Classifier
 *
 * Classifies user feedback into type + severity using keyword heuristics.
 * Does NOT block submission if classification is imperfect.
 *
 * EXPOSES: window.GLFeedbackClassifier
 */

(function() {
  'use strict';

  var TYPE_RULES = [
    { type: 'bug',                keywords: ['bug','broken','crash','error','not working','won\'t','doesn\'t work','stuck','freezes','blank','missing','wrong','fails','failed'] },
    { type: 'ux_confusion',       keywords: ['confus','unclear','don\'t understand','what does','how do','where is','can\'t find','not obvious','hard to','weird','unintuitive'] },
    { type: 'feature_request',    keywords: ['wish','would be nice','could you add','feature','should have','want','need','add support','please add','it\'d be great','suggestion'] },
    { type: 'copy_issue',         keywords: ['typo','wording','text says','label','says','misspell','grammar','the word','should say','rename'] },
    { type: 'performance_issue',  keywords: ['slow','lag','takes forever','loading','hang','timeout','speed','performance','sluggish'] },
    { type: 'data_issue',         keywords: ['lost data','data gone','missing data','wrong data','old data','showing wrong','data from','shouldn\'t show','duplicat'] },
    { type: 'onboarding_friction',keywords: ['first time','new user','getting started','onboarding','setup','don\'t know where to start','lost'] },
    { type: 'praise',             keywords: ['love','awesome','great','amazing','nice','thank','perfect','exactly what','works great','beautiful'] }
  ];

  var SEVERITY_SIGNALS = {
    critical: ['crash','data loss','lost data','can\'t sign in','blank screen','completely broken','data gone'],
    high:     ['not working','broken','stuck','fails','wrong data','can\'t save','won\'t load'],
    medium:   ['confus','unclear','slow','weird','hard to','missing'],
    low:      ['wish','would be nice','typo','wording','suggestion','minor']
  };

  function classify(message, autoContext) {
    var msg = (message || '').toLowerCase();
    autoContext = autoContext || {};

    // Determine type
    var type = 'other';
    var maxScore = 0;
    TYPE_RULES.forEach(function(rule) {
      var score = 0;
      rule.keywords.forEach(function(kw) {
        if (msg.indexOf(kw) >= 0) score++;
      });
      if (score > maxScore) { maxScore = score; type = rule.type; }
    });

    // Auto-generated reports get type from context
    if (autoContext.autoType) type = autoContext.autoType;

    // Determine severity
    var severity = 'medium';
    if (SEVERITY_SIGNALS.critical.some(function(k) { return msg.indexOf(k) >= 0; })) severity = 'critical';
    else if (SEVERITY_SIGNALS.high.some(function(k) { return msg.indexOf(k) >= 0; })) severity = 'high';
    else if (SEVERITY_SIGNALS.low.some(function(k) { return msg.indexOf(k) >= 0; })) severity = 'low';

    // Auto friction events default to medium
    if (autoContext.auto && severity === 'medium' && !maxScore) severity = 'low';
    // Render errors are always high
    if (autoContext.autoType === 'bug' && autoContext.hasRenderError) severity = 'high';

    return { type: type, severity: severity, confidence: maxScore > 0 ? Math.min(maxScore / 3, 1) : 0.3 };
  }

  window.GLFeedbackClassifier = { classify: classify };
  console.log('\uD83D\uDCCA GLFeedbackClassifier loaded');
})();
