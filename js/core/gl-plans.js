/**
 * gl-plans.js — Lightweight Plan + Founder Access System
 *
 * Plan types: 'founder' | 'trial' | 'paid'
 * Default: 'trial'
 *
 * No billing logic. No usage limits. Just data model + value signal capture.
 * Stripe scaffold ready for future integration.
 *
 * LOAD ORDER: after firebase-service.js
 */

(function() {
  'use strict';

  var PLANS = { FOUNDER: 'founder', TRIAL: 'trial', PAID: 'paid' };
  var _currentPlan = null;
  var FOUNDER_CODES = ['GROOVELINX2026', 'DEADCETERA', 'LOCKITIN'];

  // ── Load Plan ─────────────────────────────────────────────────────────

  async function loadPlan() {
    // Check localStorage cache first (fast)
    var cached = localStorage.getItem('gl_band_plan');
    if (cached) _currentPlan = cached;

    // Load from Firebase (canonical)
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try {
        var snap = await firebaseDB.ref(bandPath('meta/plan')).once('value');
        var plan = snap.val();
        if (plan && typeof plan === 'string') {
          _currentPlan = plan;
          localStorage.setItem('gl_band_plan', plan);
        } else {
          // Default to trial
          _currentPlan = PLANS.TRIAL;
        }
      } catch(e) {
        if (!_currentPlan) _currentPlan = PLANS.TRIAL;
      }
    }
    if (!_currentPlan) _currentPlan = PLANS.TRIAL;
    return _currentPlan;
  }

  // ── Set Plan ──────────────────────────────────────────────────────────

  async function setPlan(plan) {
    if (!plan || !PLANS[plan.toUpperCase()]) return false;
    _currentPlan = plan;
    localStorage.setItem('gl_band_plan', plan);
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try {
        await firebaseDB.ref(bandPath('meta/plan')).set(plan);
        return true;
      } catch(e) { return false; }
    }
    return true;
  }

  // ── Founder Code ──────────────────────────────────────────────────────

  function validateFounderCode(code) {
    if (!code) return false;
    return FOUNDER_CODES.indexOf(code.trim().toUpperCase()) >= 0;
  }

  async function redeemFounderCode(code) {
    if (!validateFounderCode(code)) return false;
    var success = await setPlan(PLANS.FOUNDER);
    if (success) {
      // Log the redemption
      if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
        try {
          await firebaseDB.ref(bandPath('meta/founderRedeemed')).set({
            code: code.trim().toUpperCase(),
            redeemedAt: new Date().toISOString(),
            redeemedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
          });
        } catch(e) {}
      }
      if (typeof showToast === 'function') showToast('\uD83C\uDF1F Founder access activated!');
    }
    return success;
  }

  // ── Value Signal ──────────────────────────────────────────────────────
  // Shown after 2+ rehearsal sessions. Captures willingness-to-pay.

  function shouldShowValueSignal() {
    // Don't show to founders or paid
    if (_currentPlan === PLANS.FOUNDER || _currentPlan === PLANS.PAID) return false;
    // Already responded
    if (localStorage.getItem('gl_value_signal_responded')) return false;
    // Need 2+ sessions
    try {
      var sessions = JSON.parse(localStorage.getItem('gl_rehearsal_agenda') || '{}');
      var history = sessions.completionHistory || [];
      return history.length >= 2;
    } catch(e) { return false; }
  }

  function showValueSignalPrompt() {
    if (!shouldShowValueSignal()) return;
    var overlay = document.createElement('div');
    overlay.id = 'glValueSignal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
    overlay.innerHTML = '<div style="max-width:380px;width:100%;background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:28px 24px;text-align:center">'
      + '<div style="font-size:1.3em;font-weight:800;color:#f1f5f9;margin-bottom:8px">Quick question</div>'
      + '<div style="font-size:0.88em;color:#94a3b8;margin-bottom:20px;line-height:1.5">Would GrooveLinx be worth $10\u201320/month for your band?</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px">'
      + '<button onclick="GLPlans._respondValue(\'yes\')" style="padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:700;font-size:0.9em;cursor:pointer">\uD83D\uDC4D Yes, definitely</button>'
      + '<button onclick="GLPlans._respondValue(\'maybe\')" style="padding:12px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;font-weight:600;font-size:0.9em;cursor:pointer">\uD83E\uDD14 Maybe</button>'
      + '<button onclick="GLPlans._respondValue(\'no\')" style="padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;font-weight:600;font-size:0.85em;cursor:pointer">Not right now</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
  }

  async function _respondValue(response) {
    localStorage.setItem('gl_value_signal_responded', response);
    // Save to Firebase
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      try {
        await firebaseDB.ref(bandPath('meta/valueSignal')).set({
          response: response,
          respondedAt: new Date().toISOString(),
          respondedBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
          plan: _currentPlan,
          sessionCount: (function() {
            try { return JSON.parse(localStorage.getItem('gl_rehearsal_agenda') || '{}').completionHistory.length; } catch(e) { return 0; }
          })()
        });
      } catch(e) {}
    }
    // Track
    if (typeof logActivity === 'function') logActivity('value_signal', { response: response });
    // Close
    var el = document.getElementById('glValueSignal');
    if (el) el.remove();
    if (response === 'yes') {
      if (typeof showToast === 'function') showToast('\uD83D\uDE4F Thanks! We\u2019ll let you know when pricing is live.');
    } else {
      if (typeof showToast === 'function') showToast('Got it. Thanks for the feedback.');
    }
  }

  // ── Stripe Scaffold ───────────────────────────────────────────────────
  // Placeholder for future Stripe integration. No active billing.

  var _stripeConfig = {
    publishableKey: null, // Set when Stripe account is ready
    priceIds: {
      monthly: null,  // e.g. 'price_xxxxx'
      yearly: null    // e.g. 'price_yyyyy'
    }
  };

  function isStripeReady() {
    return !!_stripeConfig.publishableKey;
  }

  // ── Plan Badge ────────────────────────────────────────────────────────

  function getPlanBadge() {
    if (_currentPlan === PLANS.FOUNDER) return { label: '\uD83C\uDF1F Founder', color: '#f59e0b' };
    if (_currentPlan === PLANS.PAID) return { label: '\u2B50 Pro', color: '#22c55e' };
    return { label: 'Free', color: '#64748b' };
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.GLPlans = {
    PLANS: PLANS,
    loadPlan: loadPlan,
    setPlan: setPlan,
    getPlan: function() { return _currentPlan || PLANS.TRIAL; },
    getPlanBadge: getPlanBadge,
    validateFounderCode: validateFounderCode,
    redeemFounderCode: redeemFounderCode,
    shouldShowValueSignal: shouldShowValueSignal,
    showValueSignalPrompt: showValueSignalPrompt,
    isStripeReady: isStripeReady,
    _respondValue: _respondValue
  };

  // Auto-load plan on boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(loadPlan, 2000); });
  } else {
    setTimeout(loadPlan, 2000);
  }

  console.log('\uD83D\uDCB3 GLPlans loaded');
})();
