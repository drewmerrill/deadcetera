// ============================================================================
// js/ui/gl-scope-chip.js
//
// GLScopeChip — tiny helper for inline scope labeling on intelligence cards.
//
// Per Reality Audit #10 (Home Page Intelligence Hierarchy, 2026-05-14): the
// codebase had ZERO shared vocabulary for telling the user which mental model
// (YOU vs BAND vs REHEARSAL vs GIG vs SCHEDULE) an insight applies to. This
// module is the lightweight pre-tester implementation of the chip system.
//
// Public API:
//   GLScopeChip.render(scope)
//     → '<span class="gl-scope-chip gl-scope-chip--band">BAND</span>'
//   GLScopeChip.SCOPES — array of valid scope strings
//
// Usage in render code:
//   html += GLScopeChip.render('rehearsal') + ' Sunday\'s rehearsal at risk';
//
// CSS is injected once on first call; no separate stylesheet required.
//
// Doctrine:
//   - "a good bandmate quietly helping" — subtle pill, not loud
//   - inline at start of headline; never replace headline copy
//   - color-coded by scope but muted (never alarming)
//   - NOT visible on action button labels (chip is on parent card)
//   - NOT visible on activity-feed entries (timeline IS the context)
// ============================================================================

(function () {
  'use strict';

  var SCOPES = {
    you:        { label: 'YOU',        color: '#a5b4fc', bg: 'rgba(165,180,252,0.10)', border: 'rgba(165,180,252,0.25)' },
    band:       { label: 'BAND',       color: '#86efac', bg: 'rgba(134,239,172,0.08)', border: 'rgba(134,239,172,0.22)' },
    rehearsal:  { label: 'REHEARSAL',  color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)' },
    gig:        { label: 'GIG',        color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.28)' },
    schedule:   { label: 'SCHEDULE',   color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.22)' },
  };

  var _cssInjected = false;
  function _injectCSS() {
    if (_cssInjected || typeof document === 'undefined') return;
    try {
      var el = document.createElement('style');
      el.id = 'gl-scope-chip-css';
      el.textContent =
        '.gl-scope-chip{display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.55em;font-weight:800;letter-spacing:0.08em;line-height:1.4;vertical-align:middle;margin-right:6px;text-transform:uppercase;border:1px solid;white-space:nowrap}';
      document.head.appendChild(el);
      _cssInjected = true;
    } catch(e) { /* non-fatal */ }
  }

  function render(scope) {
    if (!scope) return '';
    var s = SCOPES[String(scope).toLowerCase()];
    if (!s) return '';
    _injectCSS();
    return '<span class="gl-scope-chip" style="color:' + s.color
      + ';background:' + s.bg
      + ';border-color:' + s.border + '">' + s.label + '</span>';
  }

  // Public surface
  window.GLScopeChip = {
    render: render,
    SCOPES: Object.keys(SCOPES),
  };
})();
