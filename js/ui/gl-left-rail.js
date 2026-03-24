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
  // Top-level item (above all sections)
  var NAV_TOP = { page: 'home', icon: '🏠', label: 'Home', tip: 'See your band\'s current status and what to do next' };

  // Intent-driven nav groups — every tip is action-oriented (verb + outcome)
  var NAV_SECTIONS = [
    { title: 'Solo', items: [
      { page: 'practice',  icon: '🎯', label: 'Practice', tip: 'Practice songs, improve readiness, and track progress' },
    ]},
    { title: 'Band', items: [
      { page: 'songs',     icon: '🎵', label: 'Songs',     tip: 'Manage your song library, charts, and song details' },
      { page: 'setlists',  icon: '📋', label: 'Setlists',  tip: 'Build and organize setlists for upcoming gigs' },
      { page: 'rehearsal', icon: '🎸', label: 'Rehearsal',  tip: 'Plan and run a structured band rehearsal' },
      { page: 'ideas',     icon: '💬', label: 'Band Room',  tip: 'Pitch songs, vote, and make band decisions' },
      { page: 'feed',      icon: '\uD83D\uDCE1', label: 'Feed',       tip: 'See all band notes, ideas, and decisions in one place' },
    ]},
    { title: 'Gigs', items: [
      { page: 'gigs',      icon: '🎤', label: 'Gigs',       tip: 'Manage gigs, link setlists, and track performance details' },
      { page: 'calendar',  icon: '📆', label: 'Calendar',   tip: 'View and schedule gigs, rehearsals, and band events' },
      { page: 'venues',    icon: '🏛️', label: 'Venues',     tip: 'Store venue details, notes, and logistics' },
      { page: 'stageplot', icon: '🎭', label: 'Stage Plot',  tip: 'Design stage layouts and plan band setup' },
    ]},
    { title: 'Tools', items: [
      { page: 'playlists',   icon: '🎧', label: 'Playlists',    tip: 'Create playlists for practice, learning, and inspiration' },
      { page: 'pocketmeter', icon: '🎚️', label: 'Pocket Meter', tip: 'Measure timing, groove, and band tightness' },
      { page: 'tuner',       icon: '🔱', label: 'Tuner',         tip: 'Tune your instrument with a live pitch detector' },
      { page: 'metronome',   icon: '🥁', label: 'Metronome',     tip: 'Set tempo and practice with a steady click' },
    ]},
    { title: 'Admin', items: [
      { page: 'bestshot',      icon: '🏆', label: 'Best Shot',     tip: 'Capture and review your best performances' },
      { page: 'social',        icon: '📣', label: 'Social Media',  tip: 'Manage posts and promote your band' },
      { page: 'finances',      icon: '💰', label: 'Finances',      tip: 'Track band income, expenses, and payouts' },
      { page: 'equipment',     icon: '🎛️', label: 'Equipment',    tip: 'Manage gear, setups, and equipment notes' },
      { page: 'contacts',      icon: '👥', label: 'Contacts',      tip: 'Store and manage band and venue contacts' },
      { page: 'notifications', icon: '🔔', label: 'Notifications', tip: 'View updates, alerts, and band activity' },
      { page: 'admin',         icon: '⚙️', label: 'Settings',     tip: 'Customize your GrooveLinx experience' },
      { page: 'help',          icon: '❓', label: 'Help',           tip: 'Get help and learn how to use GrooveLinx' },
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
      GLStore.subscribe('productModeChanged', function () {
        _ensureRail();
        _renderNav();
        _applyCollapsedState();
        var current = GLStore.getActivePage();
        if (current) updateActive(current);
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

    var currentMode = (typeof GLStore !== 'undefined' && GLStore.getProductMode)
      ? GLStore.getProductMode() : 'sharpen';
    var modePages = (typeof GLStore !== 'undefined' && GLStore.getModePages)
      ? GLStore.getModePages(currentMode) : null;

    var html = '<button class="gl-rail-toggle" title="Collapse navigation">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">'
      + '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
      + '</svg></button>';

    // ── Mode Switcher ──────────────────────────────────────────────────────
    var modes = [
      { key: 'sharpen', icon: '\uD83D\uDD25', label: 'Sharpen' },
      { key: 'lockin',  icon: '\uD83C\uDFAF', label: 'Lock In' },
      { key: 'play',    icon: '\uD83C\uDFA4', label: 'Play' }
    ];
    html += '<div class="gl-mode-bar">';
    for (var m = 0; m < modes.length; m++) {
      var md = modes[m];
      var active = (md.key === currentMode) ? ' gl-mode-btn--active' : '';
      html += '<button class="gl-mode-btn' + active + '" data-mode="' + md.key + '"'
        + ' onclick="GLStore.setProductMode(\'' + md.key + '\')" title="' + md.label + ' mode">'
        + '<span class="gl-mode-icon">' + md.icon + '</span>'
        + '<span class="gl-mode-label">' + md.label + '</span>'
        + '</button>';
    }
    html += '</div>';

    // Home — top-level, above all sections
    html += '<button class="gl-rail-item gl-rail-item--home" data-page="' + NAV_TOP.page + '"'
      + ' onclick="showPage(\'' + NAV_TOP.page + '\')" title="' + (NAV_TOP.tip || NAV_TOP.label) + '">'
      + '<span class="gl-rail-icon">' + NAV_TOP.icon + '</span>'
      + '<span class="gl-rail-label">' + NAV_TOP.label + '</span></button>';

    // Intent-based sections — filtered by current mode
    for (var s = 0; s < NAV_SECTIONS.length; s++) {
      var section = NAV_SECTIONS[s];
      // Filter items to only those visible in current mode
      var visibleItems = [];
      for (var i = 0; i < section.items.length; i++) {
        var item = section.items[i];
        if (!modePages || modePages.indexOf(item.page) !== -1) {
          visibleItems.push(item);
        }
      }
      if (visibleItems.length === 0) continue; // skip empty sections

      html += '<div class="gl-rail-section">';
      html += '<div class="gl-rail-section-title">' + section.title + '</div>';
      for (var vi = 0; vi < visibleItems.length; vi++) {
        var vitem = visibleItems[vi];
        var tooltip = vitem.tip || vitem.label;
        html += '<button class="gl-rail-item" data-page="' + vitem.page + '"'
          + ' onclick="showPage(\'' + vitem.page + '\')"'
          + ' title="' + tooltip + '">'
          + '<span class="gl-rail-icon" style="position:relative">' + vitem.icon
          + (vitem.page === 'ideas' ? '<span class="gl-rail-badge" id="glRailBandRoomBadge" style="display:none;position:absolute;top:-4px;right:-6px;background:#fbbf24;color:#000;font-size:0.5em;font-weight:800;border-radius:50%;min-width:14px;height:14px;line-height:14px;text-align:center;padding:0 3px;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>' : '')
          + '</span>'
          + '<span class="gl-rail-label">' + vitem.label + '</span>'
          + '</button>';
      }
      html += '</div>';
    }

    _rail.innerHTML = html;
    _items = _rail.querySelectorAll('.gl-rail-item');
  }

  // ── Band Room badge ────────────────────────────────────────────────────
  // Uses FeedActionState identity for correct vote key matching.
  // Previous version used email prefix which didn't match vote storage format.
  async function _updateBandRoomBadge() {
    try {
      var db = (typeof firebaseDB !== 'undefined') ? firebaseDB : null;
      if (!db || typeof bandPath !== 'function') return;
      // Use FeedActionState for correct identity (display name = vote key)
      var voteKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyVoteKey)
          ? FeedActionState.getMyVoteKey() : null;
      // Fallback: email prefix (legacy, less reliable)
      if (!voteKey) voteKey = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'me';
      var cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      var snap = await db.ref(bandPath('polls')).orderByChild('ts').limitToLast(10).once('value');
      var val = snap.val();
      var count = 0;
      if (val) {
        Object.values(val).forEach(function(p) {
          if (p.ts > cutoff && p.options && p.options.length && (!p.votes || p.votes[voteKey] === undefined)) count++;
        });
      }
      var badge = document.getElementById('glRailBandRoomBadge');
      if (badge) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    } catch(e) {}
  }
  // Check badge on init and periodically
  setTimeout(_updateBandRoomBadge, 3000);
  setInterval(_updateBandRoomBadge, 120000); // refresh every 2 min

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
