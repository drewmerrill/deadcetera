/**
 * gl-left-rail.js — Milestone 4 Phase 2
 * Persistent left navigation rail for the Band Command Center shell.
 *
 * RESPONSIBILITIES:
 *   - Render nav items into #gl-left-rail
 *   - Subscribe to GLStore pageChanged to update active state
 *   - Handle collapse/expand toggle via GLStore.setNavCollapsed()
 *   - On mobile (<900px), rail is hidden — hamburger menu handles nav
 *
 * MUST NOT:
 *   - Own page navigation logic (delegates to showPage())
 *   - Own any Firebase reads
 *   - Run before GLStore is loaded
 *
 * LOAD ORDER: after groovelinx_store.js, before app-dev.js
 */

(function () {
  'use strict';

  var _rail = null;
  var _items = null; // NodeList of .gl-rail-item elements

  // Nav structure — mirrors the slide-out menu sections
  // Full navigation schema — matches the hamburger slide-out menu in index.html.
  // Both surfaces must stay in sync. If you add a page here, add it to
  // the slide-out menu too (and vice versa).
  var NAV_SECTIONS = [
    { title: 'Music', sub: 'Songs, practice, rehearsal', items: [
      { page: 'home',      icon: '🏠', label: 'Home' },
      { page: 'songs',     icon: '🎵', label: 'Songs' },
      { page: 'setlists',  icon: '📋', label: 'Setlists' },
      { page: 'practice',  icon: '🎯', label: 'Practice' },
      { page: 'rehearsal', icon: '📅', label: 'Rehearsals' },
    ]},
    { title: 'Gigs', sub: 'Shows, venues, calendar', items: [
      { page: 'gigs',     icon: '🎤', label: 'Gigs' },
      { page: 'calendar', icon: '📆', label: 'Calendar' },
      { page: 'venues',   icon: '🏛️', label: 'Venues' },
    ]},
    { title: 'Tools', sub: 'Tuner, meter, playlists', items: [
      { page: 'playlists',   icon: '🎧', label: 'Playlists' },
      { page: 'pocketmeter', icon: '🎚️', label: 'Pocket Meter' },
      { page: 'tuner',       icon: '🎸', label: 'Tuner' },
      { page: 'metronome',   icon: '🥁', label: 'Metronome' },
    ]},
    { title: 'More', sub: 'Business, settings, help', items: [
      { page: 'bestshot',      icon: '🏆', label: 'Best Shot' },
      { page: 'social',        icon: '📣', label: 'Social Media' },
      { page: 'finances',      icon: '💰', label: 'Finances' },
      { page: 'equipment',     icon: '🎛️', label: 'Equipment' },
      { page: 'contacts',      icon: '👥', label: 'Contacts' },
      { page: 'notifications', icon: '🔔', label: 'Notifications' },
      { page: 'admin',         icon: '⚙️', label: 'Settings' },
      { page: 'help',          icon: '❓', label: 'Help' },
    ]},
  ];

  // ── Public API ──────────────────────────────────────────────────────────

  window.glLeftRail = {
    init: init,
    updateActive: updateActive,
  };

  // ── Init ────────────────────────────────────────────────────────────────

  var _subscribed = false; // prevent duplicate GLStore subscriptions

  function init() {
    _rail = document.getElementById('gl-left-rail');
    if (!_rail) {
      // Defensive: retry once after a short delay in case DOM isn't ready yet
      setTimeout(function () {
        _rail = document.getElementById('gl-left-rail');
        if (_rail) init();
      }, 200);
      return;
    }

    _renderNav();
    _applyCollapsedState();

    // Subscribe to GLStore events (once only)
    if (!_subscribed && typeof GLStore !== 'undefined') {
      _subscribed = true;
      GLStore.subscribe('pageChanged', function (payload) {
        _ensureRail();
        updateActive(payload.page);
      });
      GLStore.subscribe('navCollapsedChanged', function () {
        _ensureRail();
        _applyCollapsedState();
      });
      GLStore.subscribe('appModeChanged', function (payload) {
        _ensureRail();
        if (_rail) _rail.style.display = (payload.mode === 'performance') ? 'none' : '';
      });
      // Set initial active from current page
      var current = GLStore.getActivePage();
      if (current) updateActive(current);
    }

    // Collapse toggle button — only persists preference at >=1200px
    var toggle = _rail.querySelector('.gl-rail-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (window.innerWidth >= 901 && window.innerWidth < 1200) return;
        var userPref = localStorage.getItem('glNavCollapsed');
        var collapsed = userPref === '1' ? false : true;
        GLStore.setNavCollapsed(collapsed);
        _applyCollapsedState();
      });
    }

    console.log('✅ glLeftRail initialised');
  }

  /**
   * Defensive: re-acquire rail reference if it became detached.
   * If the live DOM element exists but _rail points to a stale node,
   * re-render into the live element.
   */
  function _ensureRail() {
    if (_rail && _rail.isConnected) return; // still live in DOM — no action needed
    var liveRail = document.getElementById('gl-left-rail');
    if (!liveRail) return;
    if (liveRail !== _rail) {
      // _rail was stale — re-acquire and re-render
      _rail = liveRail;
      _renderNav();
      _applyCollapsedState();
      var current = (typeof GLStore !== 'undefined' && GLStore.getActivePage) ? GLStore.getActivePage() : null;
      if (current) updateActive(current);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  function _renderNav() {
    if (!_rail || !_rail.isConnected) {
      _rail = document.getElementById('gl-left-rail');
    }
    if (!_rail) return;

    var html = '<button class="gl-rail-toggle" title="Collapse navigation">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">'
      + '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
      + '</svg></button>';

    for (var s = 0; s < NAV_SECTIONS.length; s++) {
      var section = NAV_SECTIONS[s];
      html += '<div class="gl-rail-section">';
      html += '<div class="gl-rail-section-title">' + section.title
        + (section.sub ? '<span class="gl-rail-section-sub">' + section.sub + '</span>' : '')
        + '</div>';
      for (var i = 0; i < section.items.length; i++) {
        var item = section.items[i];
        html += '<button class="gl-rail-item" data-page="' + item.page + '"'
          + ' onclick="showPage(\'' + item.page + '\')"'
          + ' title="' + item.label + '">'
          + '<span class="gl-rail-icon">' + item.icon + '</span>'
          + '<span class="gl-rail-label">' + item.label + '</span>'
          + '</button>';
      }
      html += '</div>';
    }

    _rail.innerHTML = html;
    _items = _rail.querySelectorAll('.gl-rail-item');
  }

  // ── Active state ────────────────────────────────────────────────────────

  function updateActive(page) {
    if (!_items) return;
    for (var i = 0; i < _items.length; i++) {
      var item = _items[i];
      if (item.dataset.page === page) {
        item.classList.add('gl-rail-item--active');
      } else {
        item.classList.remove('gl-rail-item--active');
      }
    }
  }

  // ── Collapse ────────────────────────────────────────────────────────────
  //
  // Collapse rules:
  //   >=1200px  → use user preference (localStorage glNavCollapsed), default expanded
  //   901-1199px → always collapsed for layout, regardless of user preference
  //   <=900px   → rail hidden (CSS display:none), hamburger handles nav
  //
  // The toggle button only persists preference for the >=1200px tier.
  // Auto-collapse at 901-1199px never writes to localStorage.

  /**
   * Determine whether the rail should be collapsed right now.
   * Combines responsive tier with user preference.
   */
  function _isCollapsed() {
    var w = window.innerWidth;
    if (w >= 901 && w < 1200) return true; // medium: always collapsed
    // large (>=1200): check user preference, default expanded
    var userPref = localStorage.getItem('glNavCollapsed');
    return userPref === '1';
  }

  function _applyCollapsedState() {
    var shell = document.getElementById('gl-shell');
    if (!shell) return;
    var collapsed = _isCollapsed();
    // Sync GLStore internal state without persisting (avoid writing localStorage here)
    if (typeof GLStore !== 'undefined') {
      GLStore._setNavCollapsedInternal(collapsed);
    }
    shell.classList.toggle('gl-shell--nav-collapsed', collapsed);
    // Update toggle icon
    if (_rail) {
      var toggle = _rail.querySelector('.gl-rail-toggle');
      if (toggle) {
        toggle.innerHTML = collapsed
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>'
          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>';
        toggle.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
      }
    }
  }

  // ── Auto-init ───────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
