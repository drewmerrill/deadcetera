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

    var keyword = normalizeKeyword(getPrimaryKeyword(msg));
    var page = (autoContext && autoContext.page) || '';

    return {
      type: type, severity: severity,
      confidence: maxScore > 0 ? Math.min(maxScore / 3, 1) : 0.3,
      keyword: keyword,
      clusterKey: type + '_' + (page || 'unknown') + '_' + keyword
    };
  }

  // ── Keyword Extraction ──────────────────────────────────────────────────

  var PRODUCT_KEYWORDS = [
    'save','button','search','setlist','song','rehearsal','gig','calendar','login','sign in',
    'avatar','voice','chart','member','band','feed','plan','playlist','practice','reveal',
    'notification','upload','photo','delete','edit','create','load','navigate','scroll',
    'drag','drop','picker','modal','toast','menu','tab','page','home','settings'
  ];

  var SYNONYM_MAP = {
    'saving': 'save', 'save button': 'save', 'saved': 'save',
    'playlist': 'setlist', 'song list': 'setlist', 'set list': 'setlist', 'list': 'setlist',
    'log in': 'login', 'sign-in': 'login', 'signin': 'login', 'sign up': 'login',
    'loading': 'load', 'loads': 'load', 'loaded': 'load',
    'searching': 'search', 'searched': 'search',
    'creating': 'create', 'created': 'create',
    'editing': 'edit', 'edited': 'edit',
    'deleting': 'delete', 'deleted': 'delete', 'remove': 'delete', 'removing': 'delete',
    'uploading': 'upload', 'uploaded': 'upload',
    'navigating': 'navigate', 'navigation': 'navigate',
    'scrolling': 'scroll',
    'clicking': 'button', 'click': 'button', 'tap': 'button', 'tapping': 'button', 'press': 'button',
    'band members': 'member', 'members': 'member', 'bandmate': 'member',
    'songs': 'song', 'track': 'song', 'tracks': 'song',
    'rehearsals': 'rehearsal', 'practice session': 'rehearsal',
    'gigs': 'gig', 'show': 'gig', 'shows': 'gig', 'event': 'gig',
    'notifications': 'notification', 'notif': 'notification', 'alert': 'notification',
    'photos': 'photo', 'image': 'photo', 'images': 'photo', 'picture': 'photo'
  };

  var FILLER_WORDS = ['the','this','that','a','an','is','was','are','were','it','its','my','your','i','we','they','he','she','on','in','at','to','for','of','with','and','or','but','not','no','just','very','really','so','too','also','here','there'];

  function normalizeKeyword(keyword) {
    if (!keyword) return 'general';
    var lower = keyword.toLowerCase().trim();
    // Check synonym map first (multi-word)
    if (SYNONYM_MAP[lower]) return SYNONYM_MAP[lower];
    // Single word synonym
    var words = lower.split(/\s+/).filter(function(w) { return FILLER_WORDS.indexOf(w) < 0 && w.length > 2; });
    if (words.length === 0) return 'general';
    var first = words[0];
    return SYNONYM_MAP[first] || first;
  }

  function getPrimaryKeyword(text) {
    var lower = (text || '').toLowerCase();
    // Check multi-word synonyms first
    var synKeys = Object.keys(SYNONYM_MAP);
    for (var s = 0; s < synKeys.length; s++) {
      if (lower.indexOf(synKeys[s]) >= 0) return SYNONYM_MAP[synKeys[s]];
    }
    for (var i = 0; i < PRODUCT_KEYWORDS.length; i++) {
      if (lower.indexOf(PRODUCT_KEYWORDS[i]) >= 0) return PRODUCT_KEYWORDS[i];
    }
    var words = lower.replace(/[^a-z\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 3 && FILLER_WORDS.indexOf(w) < 0; });
    return normalizeKeyword(words[0] || 'general');
  }

  // ── Issue Scoring ───────────────────────────────────────────────────────

  var SEVERITY_SCORES = { bug: 3, ux_confusion: 2, data_issue: 3, performance_issue: 2, feature_request: 1, copy_issue: 1, onboarding_friction: 2, praise: 0, other: 1 };
  var FLOW_CRITICALITY = { home: 2, setlists: 2, rehearsal: 3, 'rehearsal-mode': 3, songs: 1, gigs: 1, calendar: 1, admin: 1, feed: 1 };

  function scoreIssue(type, page, frequency, isFounder) {
    var sev = SEVERITY_SCORES[type] || 1;
    var flow = FLOW_CRITICALITY[page] || 1;
    var score = (frequency * 2) + sev + flow;
    if (isFounder) score *= 2;
    return score;
  }

  window.GLFeedbackClassifier = { classify: classify, getPrimaryKeyword: getPrimaryKeyword, normalizeKeyword: normalizeKeyword, scoreIssue: scoreIssue };
  console.log('\uD83D\uDCCA GLFeedbackClassifier loaded');
})();
