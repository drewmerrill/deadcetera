/**
 * gl_render_state.js — Never Blank Screen Again
 *
 * Ensures every page always shows a visible state:
 * loading, ready, empty, degraded, or error.
 *
 * Usage:
 *   GLRenderState.set('rehearsal', { status: 'loading' });
 *   GLRenderState.set('rehearsal', { status: 'error', message: 'Could not load' });
 *   GLRenderState.set('rehearsal', { status: 'empty', title: 'No rehearsals', cta: { label: '+ New', onclick: "rhOpenCreateModal()" } });
 *
 * LOAD ORDER: before navigation.js (or alongside it)
 */

(function() {
  'use strict';

  var _states = {}; // { page: stateObj }

  var STATUS_ICONS = {
    loading:  '',
    ready:    '',
    empty:    '',
    degraded: '\u26A0\uFE0F',
    error:    '\u274C'
  };

  /**
   * Set and render a state for a page.
   * @param {string} page  — page key (e.g., 'rehearsal')
   * @param {object} state — { status, title, message, cta }
   *   status: 'loading' | 'ready' | 'empty' | 'degraded' | 'error'
   *   title: optional heading
   *   message: optional body text
   *   cta: optional { label, onclick }
   */
  function set(page, state) {
    if (!state) return;
    _states[page] = state;
    // Only render if the page element exists and is visible (or blank)
    if (state.status === 'ready') return; // 'ready' means the real renderer handles it
    var el = document.getElementById('page-' + page);
    if (!el) return;
    // Don't overwrite content that a real renderer already placed
    if (state.status !== 'loading' && el.textContent.trim().length > 100) return;
    el.innerHTML = _renderCard(state);
  }

  /**
   * Render a state card.
   */
  function _renderCard(state) {
    var s = state.status || 'loading';
    var icon = STATUS_ICONS[s] || '';

    if (s === 'loading') {
      return '<div data-render-state="loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;padding:40px 20px;color:var(--text-dim,#64748b)">'
        + '<div style="width:28px;height:28px;border:2.5px solid rgba(99,102,241,0.15);border-top-color:#6366f1;border-radius:50%;animation:glSpin 0.6s linear infinite;margin-bottom:14px"></div>'
        + (state.title ? '<div style="font-size:0.88em;font-weight:600;color:var(--text-muted,#94a3b8)">' + _esc(state.title) + '</div>' : '')
        + '<div style="font-size:0.78em;margin-top:4px">' + _esc(state.message || 'Loading\u2026') + '</div>'
        + '</div>';
    }

    if (s === 'empty') {
      var html = '<div data-render-state="empty" style="text-align:center;padding:40px 20px;color:var(--text-dim,#64748b)">';
      if (state.icon) html += '<div style="font-size:1.8em;margin-bottom:10px">' + state.icon + '</div>';
      html += '<div style="font-weight:700;font-size:0.95em;color:var(--text-muted,#94a3b8);margin-bottom:6px">' + _esc(state.title || 'Nothing here yet') + '</div>';
      if (state.message) html += '<div style="font-size:0.85em;margin-bottom:14px;line-height:1.4">' + _esc(state.message) + '</div>';
      if (state.cta) html += '<button onclick="' + state.cta.onclick + '" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;font-size:0.88em;cursor:pointer">' + _esc(state.cta.label) + '</button>';
      html += '</div>';
      return html;
    }

    if (s === 'degraded') {
      return '<div data-render-state="degraded" style="padding:12px 16px;margin:8px;border-radius:10px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);color:#fbbf24;font-size:0.82em;display:flex;align-items:center;gap:8px">'
        + '<span>' + icon + '</span>'
        + '<span>' + _esc(state.message || 'Some data unavailable. Showing what we have.') + '</span>'
        + '</div>';
    }

    if (s === 'error') {
      var errHtml = '<div data-render-state="error" style="text-align:center;padding:40px 20px;color:var(--text-dim,#64748b)">';
      errHtml += '<div style="font-size:1.5em;margin-bottom:10px">' + icon + '</div>';
      errHtml += '<div style="font-weight:700;font-size:0.95em;color:var(--text-muted,#94a3b8);margin-bottom:6px">' + _esc(state.title || 'Something went wrong') + '</div>';
      if (state.message) errHtml += '<div style="font-size:0.85em;margin-bottom:14px">' + _esc(state.message) + '</div>';
      errHtml += '<button onclick="' + (state.retry || "location.reload()") + '" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:600;font-size:0.85em">Retry</button>';
      errHtml += '</div>';
      return errHtml;
    }

    return '';
  }

  /**
   * Get current state for a page.
   */
  function get(page) {
    return _states[page] || null;
  }

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Inject spinner keyframe once
  if (!document.getElementById('glRenderStateStyles')) {
    var st = document.createElement('style');
    st.id = 'glRenderStateStyles';
    st.textContent = '@keyframes glSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  window.GLRenderState = {
    set: set,
    get: get
  };

  console.log('\uD83D\uDEE1 GLRenderState loaded');
})();
