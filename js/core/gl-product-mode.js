// ── Product Mode (DEPRECATED) ────────────────────────────────────────────────
//
// 'sharpen' = solo practice focus
// 'lockin'  = band rehearsal focus
// 'play'    = gig / performance focus
//
// LEGACY MODE SYSTEM — NO LONGER USED FOR UI GATING. Practice/Rehearse/Play
// are conceptual perspectives used in recommendations and copy only. All
// features are always visible in a single coherent page structure. These
// functions are retained for backward compatibility with code that reads
// getProductMode() for informational purposes.
//
// LOAD ORDER: must come after groovelinx_store.js (calls GLStore.emit).
// Three consumers (gl-avatar-guide, avatar_feedback_context, home-dashboard)
// all null-check before calling, so the brief absence during load is harmless.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 9) — the state
// (was `_state.productMode`) lives in this module's closure now, sourced from
// the same localStorage key. Initial value is read at module load time, same
// as the store did before.

(function() {
  'use strict';

  var VALID_MODES = ['sharpen', 'lockin', 'play'];
  var _currentMode;
  try { _currentMode = localStorage.getItem('gl_product_mode') || 'sharpen'; }
  catch(e) { _currentMode = 'sharpen'; }

  // No-op: stores preference, no side effects (UI gating was removed long ago).
  function setProductMode(mode) {
    if (VALID_MODES.indexOf(mode) === -1) return;
    var prev = _currentMode;
    _currentMode = mode;
    try { localStorage.setItem('gl_product_mode', mode); } catch(e) {}
    if (typeof window !== 'undefined' && window.GLStore && window.GLStore.emit) {
      window.GLStore.emit('productModeChanged', { mode: mode, prev: prev });
    }
  }

  function getProductMode() {
    return _currentMode;
  }

  // DEPRECATED: all pages are always visible. Kept for backward compat.
  function getModePages() { return null; }
  function isPageVisibleInMode() { return true; }

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.setProductMode      = setProductMode;
    GL.getProductMode      = getProductMode;
    GL.getModePages        = getModePages;
    GL.isPageVisibleInMode = isPageVisibleInMode;
    GL.PRODUCT_MODES       = VALID_MODES;
    GL.MODE_PAGES          = null;  // DEPRECATED
    GL.MODE_LANDING        = null;  // DEPRECATED
  }
})();
