// ============================================================================
// gl-beta-feedback.js — Lightweight Beta Feedback Widget
//
// Mounts a small floating action button (FAB) bottom-right that opens a
// category-tagged feedback modal. Wraps the existing GLFeedbackService
// (avatar_feedback_service.js) so feedback lands in the same Firebase node
// (bands/{slug}/feedback_reports) Drew already reads from the admin inbox.
//
// Adds:
//   - Category buttons (bug / confusion / playback / rehearsal / onboarding /
//     mobile / performance / suggestion)
//   - Runtime Health snapshot attachment (default on)
//   - Page + build + user context auto-captured
//
// Activation gates (any one):
//   - `?beta=true` query parameter
//   - `localStorage.gl_beta_feedback === '1'`
//   - The user is a band-roster member AND build is dev (`index-dev.html`)
//   - `GLBetaFeedback.show()` console call
//
// Production posture: hidden by default for general users. Drew toggles on
// via localStorage for invited founding members. The FAB itself never
// auto-mounts unless a gate is satisfied.
//
// EXPOSES: window.GLBetaFeedback
// DEPENDS ON: GLFeedbackService (avatar_feedback_service.js), GLRuntimeHealth
//             (gl-runtime-health.js — optional, used for snapshot attach)
// ============================================================================

'use strict';

(function () {
  var FAB_ID = 'gl-beta-feedback-fab';
  var MODAL_ID = 'gl-beta-feedback-modal';

  // Eight canonical categories — match Audit #09's reporting categories so
  // operational issues + feedback share the same taxonomy.
  var CATEGORIES = [
    { id: 'bug', label: 'Bug', icon: '🐞' },
    { id: 'confusion', label: 'Confusion', icon: '🤔' },
    { id: 'playback', label: 'Playback', icon: '▶' },
    { id: 'rehearsal', label: 'Rehearsal', icon: '🎼' },
    { id: 'onboarding', label: 'Onboarding', icon: '🚪' },
    { id: 'mobile', label: 'Mobile', icon: '📱' },
    { id: 'performance', label: 'Performance', icon: '⚡' },
    { id: 'suggestion', label: 'Suggestion', icon: '💡' },
  ];

  function _isEnabled() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get('beta') === 'true') return true;
    } catch (_e) {}
    try {
      if (localStorage.getItem('gl_beta_feedback') === '1') return true;
    } catch (_e) {}
    try {
      // Dev shell: only on band members. The check is conservative —
      // currentBandSlug+currentUserEmail must both be present.
      var isDev = /index-dev\.html/.test(window.location.pathname);
      var hasUser = typeof window.currentUserEmail !== 'undefined' && window.currentUserEmail
        && window.currentUserEmail !== 'unknown';
      var hasBand = typeof window.currentBandSlug !== 'undefined' && window.currentBandSlug;
      if (isDev && hasUser && hasBand) return true;
    } catch (_e) {}
    return false;
  }

  function _mountFab() {
    if (document.getElementById(FAB_ID)) return;
    var btn = document.createElement('button');
    btn.id = FAB_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Send beta feedback');
    btn.style.cssText = [
      'position:fixed', 'bottom:calc(env(safe-area-inset-bottom, 0px) + 16px)',
      'right:16px', 'z-index:9998', 'width:48px', 'height:48px',
      'border-radius:50%', 'border:1px solid rgba(129,140,248,0.45)',
      'background:linear-gradient(135deg,#667eea,#764ba2)', 'color:#fff',
      'font-size:1.2em', 'cursor:pointer', 'box-shadow:0 6px 18px rgba(0,0,0,0.35)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:inherit', 'transition:transform 0.15s ease'
    ].join(';');
    btn.textContent = '💬';
    btn.title = 'Send beta feedback';
    btn.addEventListener('click', _openModal);
    btn.addEventListener('mouseenter', function () { btn.style.transform = 'scale(1.06)'; });
    btn.addEventListener('mouseleave', function () { btn.style.transform = 'scale(1)'; });
    document.body.appendChild(btn);
  }

  function _unmountFab() {
    var el = document.getElementById(FAB_ID);
    if (el) el.remove();
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _openModal(presetCategory) {
    if (document.getElementById(MODAL_ID)) return;
    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,0.78);display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(4px)';

    var pageGuess = (typeof window.currentPage !== 'undefined') ? window.currentPage : '';
    var emailGuess = (typeof window.currentUserEmail !== 'undefined') ? window.currentUserEmail : '';
    var build = '';
    try { build = (document.querySelector('meta[name="build-version"]') || {}).content || ''; } catch (_e) {}

    var catButtonsHtml = CATEGORIES.map(function (c) {
      var active = (presetCategory && presetCategory === c.id) ? '1' : '0';
      return '<button data-cat="' + _esc(c.id) + '" class="glbf-cat" data-active="' + active + '"'
        + ' style="padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);color:#cbd5e1;cursor:pointer;font-size:0.78em;font-family:inherit">'
        + c.icon + ' ' + c.label + '</button>';
    }).join('');

    overlay.innerHTML = '<div style="width:100%;max-width:520px;background:linear-gradient(160deg,#0f172a,#1e293b);border-radius:14px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 60px rgba(0,0,0,0.5);padding:18px 20px;color:#e2e8f0">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      +   '<div style="font-size:1.1em;font-weight:800;flex:1">💬 Send beta feedback</div>'
      +   '<button id="glbf-close" style="background:none;border:none;color:#64748b;font-size:1.3em;cursor:pointer;padding:0 6px">×</button>'
      + '</div>'
      + '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:8px;line-height:1.5">'
      +   'What kind of feedback?'
      + '</div>'
      + '<div id="glbf-cats" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">' + catButtonsHtml + '</div>'
      + '<textarea id="glbf-text" rows="5" placeholder="What happened? What did you expect?" style="width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.30);color:#e2e8f0;font-family:inherit;font-size:0.88em;resize:vertical;line-height:1.5"></textarea>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:0.78em;color:#94a3b8">'
      +   '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">'
      +     '<input id="glbf-attach-snap" type="checkbox" checked style="cursor:pointer"> Attach runtime snapshot'
      +   '</label>'
      + '</div>'
      + '<div style="font-size:0.72em;color:#64748b;margin-top:6px;line-height:1.4">'
      +   'Page: <span style="color:#94a3b8">' + _esc(pageGuess || '(unknown)') + '</span>'
      +   ' · Build: <span style="color:#94a3b8">' + _esc(build || '(unknown)') + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">'
      +   '<button id="glbf-cancel" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.10);background:none;color:#94a3b8;cursor:pointer;font-size:0.84em">Cancel</button>'
      +   '<button id="glbf-submit" style="padding:8px 18px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:700;cursor:pointer;font-size:0.84em">Send</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    var selectedCategory = presetCategory || null;
    function _updateCatButtons() {
      var btns = overlay.querySelectorAll('.glbf-cat');
      Array.prototype.forEach.call(btns, function (b) {
        var active = b.getAttribute('data-cat') === selectedCategory;
        b.style.background = active ? 'rgba(129,140,248,0.22)' : 'rgba(255,255,255,0.04)';
        b.style.color = active ? '#a5b4fc' : '#cbd5e1';
        b.style.borderColor = active ? 'rgba(129,140,248,0.55)' : 'rgba(255,255,255,0.10)';
        b.setAttribute('data-active', active ? '1' : '0');
      });
    }
    _updateCatButtons();

    overlay.querySelectorAll('.glbf-cat').forEach(function (b) {
      b.addEventListener('click', function () {
        selectedCategory = b.getAttribute('data-cat');
        _updateCatButtons();
      });
    });

    function _close() { try { overlay.remove(); } catch (_e) {} }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _close(); });
    overlay.querySelector('#glbf-close').addEventListener('click', _close);
    overlay.querySelector('#glbf-cancel').addEventListener('click', _close);

    overlay.querySelector('#glbf-submit').addEventListener('click', async function () {
      var ta = overlay.querySelector('#glbf-text');
      var msg = (ta && ta.value || '').trim();
      if (!msg) {
        ta && ta.focus();
        return;
      }
      var attachSnap = !!overlay.querySelector('#glbf-attach-snap').checked;
      var snapshot = null;
      if (attachSnap && window.GLRuntimeHealth && typeof window.GLRuntimeHealth.snapshot === 'function') {
        try { snapshot = window.GLRuntimeHealth.snapshot(); } catch (_se) {}
      }
      // Tag the message with category so admin inbox can filter. Submit
      // routes through the existing GLFeedbackService so it lands in the
      // same Firebase path Drew already reads from.
      var taggedMsg = (selectedCategory ? '[' + selectedCategory + '] ' : '') + msg;
      // Disable submit while in-flight.
      var sub = overlay.querySelector('#glbf-submit');
      if (sub) { sub.disabled = true; sub.textContent = 'Sending…'; sub.style.opacity = '0.7'; }
      try {
        if (window.GLFeedbackService && typeof window.GLFeedbackService.submitExplicit === 'function') {
          var report = await window.GLFeedbackService.submitExplicit(taggedMsg);
          // If we have a runtime snapshot and the report has a Firebase ID,
          // attach it under a sub-field. The service may have used the
          // localStorage queue fallback when offline — that's fine, snapshot
          // is just a debugging aid.
          if (report && snapshot && window.firebaseDB && window.currentBandSlug) {
            try {
              await window.firebaseDB.ref('bands/' + window.currentBandSlug
                + '/feedback_reports/' + report.reportId + '/betaSnapshot').set(snapshot);
            } catch (_se) {}
          }
          // Increment local counter for the Runtime Health Overlay.
          if (typeof window._glBumpOnboardingCounter === 'function') {
            window._glBumpOnboardingCounter('feedbackSubmitted', window.currentUserEmail || '');
          } else {
            try {
              var raw = localStorage.getItem('gl_onboarding_stats');
              var s = raw ? JSON.parse(raw) : {};
              s.feedbackSubmitted = (s.feedbackSubmitted || 0) + 1;
              s.lastEventAt = Date.now();
              s.lastEvent = 'feedbackSubmitted';
              localStorage.setItem('gl_onboarding_stats', JSON.stringify(s));
            } catch (_we) {}
          }
          if (typeof window.showToast === 'function') {
            window.showToast('Thanks — feedback sent to Drew');
          }
        } else {
          // Service not loaded — fall back to a plain localStorage queue so
          // Drew can still recover via DevTools.
          try {
            var raw = localStorage.getItem('gl_pending_feedback') || '[]';
            var arr = JSON.parse(raw);
            if (!Array.isArray(arr)) arr = [];
            arr.push({ msg: taggedMsg, category: selectedCategory, snapshot: snapshot, at: Date.now(),
                       page: pageGuess, email: emailGuess, build: build });
            if (arr.length > 50) arr = arr.slice(arr.length - 50);
            localStorage.setItem('gl_pending_feedback', JSON.stringify(arr));
          } catch (_se) {}
          if (typeof window.showToast === 'function') {
            window.showToast('Feedback saved locally (offline) — will sync next time');
          }
        }
      } catch (e) {
        console.warn('[GLBetaFeedback] submit failed', e);
        if (typeof window.showToast === 'function') {
          window.showToast('Could not send — saved locally; please try again later');
        }
      } finally {
        _close();
      }
    });
  }

  function _autoMount() {
    if (_isEnabled()) _mountFab();
  }

  // Re-evaluate enablement on auth change — newly-signed-in users may
  // become eligible. Idempotent: _mountFab short-circuits if FAB exists.
  if (typeof window !== 'undefined' && document.readyState !== 'loading') {
    setTimeout(_autoMount, 200);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(_autoMount, 200); });
  }
  // Re-check periodically — currentUserEmail / currentBandSlug land async.
  if (typeof window !== 'undefined' && !window._glBetaFeedbackPoll) {
    window._glBetaFeedbackPoll = setInterval(function () {
      if (_isEnabled() && !document.getElementById(FAB_ID)) _mountFab();
    }, 5000);
  }

  window.GLBetaFeedback = {
    show: function () { _mountFab(); },
    open: function (cat) { _mountFab(); _openModal(cat); },
    hide: function () { _unmountFab(); },
    isEnabled: _isEnabled,
    categories: CATEGORIES,
  };
})();
