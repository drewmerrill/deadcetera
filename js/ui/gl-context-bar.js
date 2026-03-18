/**
 * gl-context-bar.js — Navigation Stability: Persistent Mini Context Bar
 * Lightweight orientation strip at the top of the center workspace.
 *
 * SHOWS:
 *   - Current page breadcrumb (section > page label)
 *   - Active session indicator (rehearsal in progress, live gig)
 *   - Quick "back" affordance when in a sub-context
 *
 * RULES:
 *   - NEVER overlaps or replaces the Now Playing bar
 *   - Hidden on Home page (dashboard is self-contextualizing)
 *   - Hidden in performance mode (rehearsal-mode / live-gig overlays manage own UI)
 *   - Renders into a dynamically injected element at top of .main-content
 *
 * LOAD ORDER: after groovelinx_store.js, before app-dev.js
 */

(function () {
  'use strict';

  var _bar = null;
  var _currentPage = null;

  // ── Page metadata: section, label, icon ──────────────────────────────────
  var PAGE_META = {
    home:            { section: '',       label: 'Home',                icon: '🏠' },
    songs:           { section: 'Band',   label: 'Songs',              icon: '🎵' },
    setlists:        { section: 'Band',   label: 'Setlists',           icon: '📋' },
    practice:        { section: 'Solo',   label: 'Practice',           icon: '🎯' },
    rehearsal:       { section: 'Band',   label: 'Rehearsal',          icon: '📅' },
    'rehearsal-intel': { section: 'Band', label: 'Rehearsal Intelligence', icon: '📅' },
    ideas:           { section: 'Band',   label: 'Band Room',          icon: '🎸' },
    gigs:            { section: 'Gigs',   label: 'Gigs',               icon: '🎤' },
    calendar:        { section: 'Gigs',   label: 'Calendar',           icon: '📆' },
    venues:          { section: 'Gigs',   label: 'Venues',             icon: '🏛️' },
    stageplot:       { section: 'Gigs',   label: 'Stage Plot',         icon: '🎭' },
    playlists:       { section: 'Tools',  label: 'Playlists',          icon: '🎧' },
    pocketmeter:     { section: 'Tools',  label: 'Pocket Meter',       icon: '🎚️' },
    tuner:           { section: 'Tools',  label: 'Tuner',              icon: '🎸' },
    metronome:       { section: 'Tools',  label: 'Metronome',          icon: '🥁' },
    bestshot:        { section: 'Admin',  label: 'Best Shot',          icon: '🏆' },
    social:          { section: 'Admin',  label: 'Social Media',       icon: '📣' },
    finances:        { section: 'Admin',  label: 'Finances',           icon: '💰' },
    equipment:       { section: 'Admin',  label: 'Equipment',          icon: '🎛️' },
    contacts:        { section: 'Admin',  label: 'Contacts',           icon: '👥' },
    notifications:   { section: 'Admin',  label: 'Notifications',      icon: '🔔' },
    admin:           { section: 'Admin',  label: 'Settings',           icon: '⚙️' },
    help:            { section: 'Admin',  label: 'Help',               icon: '❓' },
  };

  // ── Public API ───────────────────────────────────────────────────────────
  window.glContextBar = {
    init: init,
    update: update,
  };

  // ── Init ─────────────────────────────────────────────────────────────────

  function init() {
    var main = document.getElementById('mainContent');
    if (!main) return;

    // Create the bar element
    _bar = document.createElement('div');
    _bar.id = 'gl-context-bar';
    _bar.className = 'gl-ctx-bar';
    _bar.style.display = 'none';
    main.insertBefore(_bar, main.firstChild);

    // Subscribe to GLStore page changes
    if (typeof GLStore !== 'undefined') {
      GLStore.subscribe('pageChanged', function (payload) {
        update(payload.page);
      });
      GLStore.subscribe('appModeChanged', function (payload) {
        if (_bar) {
          _bar.style.display = (payload.mode === 'performance') ? 'none' : '';
          if (payload.mode !== 'performance') update(_currentPage);
        }
      });
      GLStore.subscribe('gl-song-selected', function () {
        update(_currentPage);
      });
      GLStore.subscribe('gl-song-cleared', function () {
        update(_currentPage);
      });

      // Initial render
      var current = GLStore.getActivePage();
      if (current) update(current);
    }

    // Inject styles once
    _injectStyles();
    console.log('✅ glContextBar initialised');
  }

  // ── Update ───────────────────────────────────────────────────────────────

  function update(page) {
    if (!_bar) return;
    _currentPage = page;

    // Hide on home — the dashboard provides its own context
    if (!page || page === 'home') {
      _bar.style.display = 'none';
      return;
    }

    var meta = PAGE_META[page];
    if (!meta) {
      _bar.style.display = 'none';
      return;
    }

    // Build breadcrumb
    var html = '<div class="gl-ctx-breadcrumb">';
    html += '<span class="gl-ctx-home" onclick="showPage(\'home\')" title="Home">🏠</span>';
    if (meta.section) {
      html += '<span class="gl-ctx-sep">/</span>';
      html += '<span class="gl-ctx-section">' + meta.section + '</span>';
    }
    html += '<span class="gl-ctx-sep">/</span>';
    html += '<span class="gl-ctx-page">' + meta.icon + ' ' + meta.label + '</span>';

    // Append selected song name when on songs page with panel open
    if (page === 'songs' && typeof GLStore !== 'undefined' && GLStore.getSelectedSong) {
      var sel = GLStore.getSelectedSong();
      if (sel) {
        html += '<span class="gl-ctx-sep">/</span>';
        html += '<span class="gl-ctx-song">' + _esc(sel) + '</span>';
      }
    }
    html += '</div>';

    // Session indicator — check for active rehearsal or gig
    var sessionHtml = _getSessionIndicator();
    if (sessionHtml) {
      html += sessionHtml;
    }

    _bar.innerHTML = html;
    _bar.style.display = '';
  }

  // ── Session indicator ────────────────────────────────────────────────────

  function _getSessionIndicator() {
    if (typeof GLStore === 'undefined') return '';

    // Check for active rehearsal session
    var appMode = GLStore.getAppMode ? GLStore.getAppMode() : null;
    if (appMode === 'performance') return ''; // handled by overlay UI

    // Check for live rehearsal song (indicates rehearsal mode was used)
    var liveRehearsalSong = GLStore.getLiveRehearsalSong ? GLStore.getLiveRehearsalSong() : null;
    if (liveRehearsalSong) {
      return '<div class="gl-ctx-session gl-ctx-session--rehearsal">'
        + '<span class="gl-ctx-session-dot"></span>'
        + 'Rehearsal active'
        + '</div>';
    }

    return '';
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  function _injectStyles() {
    if (document.getElementById('gl-context-bar-styles')) return;
    var style = document.createElement('style');
    style.id = 'gl-context-bar-styles';
    style.textContent = [
      '.gl-ctx-bar{',
      '  display:flex;align-items:center;justify-content:space-between;',
      '  padding:6px 16px;',
      '  background:rgba(15,23,42,0.6);',
      '  border-bottom:1px solid rgba(255,255,255,0.04);',
      '  font-size:0.72em;',
      '  font-weight:600;',
      '  color:var(--text-dim,#475569);',
      '  letter-spacing:0.02em;',
      '  min-height:28px;',
      '  flex-shrink:0;',
      '  user-select:none;',
      '}',
      '.gl-ctx-breadcrumb{display:flex;align-items:center;gap:6px}',
      '.gl-ctx-home{cursor:pointer;opacity:0.5;font-size:1.1em}',
      '.gl-ctx-home:hover{opacity:1}',
      '.gl-ctx-sep{opacity:0.3;font-size:0.9em}',
      '.gl-ctx-section{color:var(--text-dim,#475569);opacity:0.7}',
      '.gl-ctx-page{color:var(--text-muted,#94a3b8)}',
      '.gl-ctx-song{color:var(--accent-light,#818cf8);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gl-ctx-session{',
      '  display:flex;align-items:center;gap:6px;',
      '  padding:3px 10px;border-radius:12px;',
      '  font-size:0.92em;font-weight:700;',
      '}',
      '.gl-ctx-session--rehearsal{',
      '  background:rgba(34,197,94,0.1);',
      '  color:#4ade80;',
      '  border:1px solid rgba(34,197,94,0.2);',
      '}',
      '.gl-ctx-session-dot{',
      '  width:6px;height:6px;border-radius:50%;',
      '  background:#4ade80;',
      '  animation:gl-ctx-pulse 2s ease-in-out infinite;',
      '}',
      '@keyframes gl-ctx-pulse{0%,100%{opacity:1}50%{opacity:0.4}}',
      // Mobile: slightly smaller
      '@media(max-width:900px){',
      '  .gl-ctx-bar{padding:4px 12px;font-size:0.68em;min-height:24px}',
      '  .gl-ctx-section{display:none}',
      '  .gl-ctx-section+.gl-ctx-sep{display:none}',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Auto-init ──────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
