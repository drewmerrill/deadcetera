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

  // ── Nav structure — emoji icons (recognizable, colorful, cross-platform) ──
  var NAV_TOP = { page: 'home', icon: '\uD83C\uDFE0', label: 'Home', tip: 'Your band dashboard' };

  var NAV_SECTIONS = [
    { title: '', primary: true, items: [
      { page: 'songs',     icon: '\uD83C\uDFB5', label: 'Songs',     tip: 'Your song library and charts' },
      { page: 'rehearsal', icon: '\uD83C\uDFB8', label: 'Rehearsal', tip: 'Plan and run your next rehearsal' },
      { page: 'calendar',  icon: '\uD83D\uDCC5', label: 'Schedule',  tip: 'Gigs, rehearsals, and events' },
      { page: 'setlists',  icon: '\uD83D\uDCCB', label: 'Setlists',  tip: 'Build and organize setlists' },
    ]},
    { title: 'Band', items: [
      { page: 'gigs',      icon: '\uD83C\uDFA4', label: 'Gigs',       tip: 'Manage gigs and performances' },
      { page: 'ideas',     icon: '\uD83D\uDCAC', label: 'Band Room',  tip: 'Pitch songs, vote, and decisions' },
      { page: 'feed',      icon: '\uD83D\uDCE1', label: 'Feed',       tip: 'Band notes and discussions' },
      { page: 'admin',     icon: '\u2699\uFE0F', label: 'Settings',    tip: 'Band members and settings' },
    ]},
    { title: 'Tools', items: [
      { page: 'practice',    icon: '\uD83C\uDFAF', label: 'Practice',     tip: 'Practice songs and track progress' },
      { page: 'playlists',   icon: '\uD83C\uDFA7', label: 'Playlists',    tip: 'Practice and learning playlists' },
      { page: 'pocketmeter', icon: '\uD83C\uDF9A\uFE0F', label: 'Pocket Meter', tip: 'Timing and groove' },
      { page: 'tuner',       icon: '\uD83D\uDD31', label: 'Tuner',        tip: 'Tune your instrument' },
      { page: 'metronome',   icon: '\uD83E\uDD41', label: 'Metronome',    tip: 'Tempo and click' },
      { page: 'stageplot',   icon: '\uD83C\uDFAD', label: 'Stage Plot',   tip: 'Stage layouts' },
      { page: 'venues',      icon: '\uD83C\uDFDB\uFE0F', label: 'Venues', tip: 'Venue details and logistics' },
      { page: 'equipment',   icon: '\uD83C\uDF9B\uFE0F', label: 'Equipment', tip: 'Gear and setups' },
    ]},
    { title: 'More', items: [
      { page: 'finances',      icon: '\uD83D\uDCB0', label: 'Finances',      tip: 'Income, expenses, payouts' },
      { page: 'social',        icon: '\uD83D\uDCE3', label: 'Social Media',  tip: 'Posts and promotion' },
      { page: 'bestshot',      icon: '\uD83C\uDFC6', label: 'Best Shot',     tip: 'Best performances' },
      { page: 'contacts',      icon: '\uD83D\uDC65', label: 'Contacts',      tip: 'Band and venue contacts' },
      { page: 'notifications', icon: '\uD83D\uDD14', label: 'Notifications', tip: 'Updates and alerts' },
      { page: 'help',          icon: '\u2753', label: 'Help',                 tip: 'Help and guides' },
    ]},
  ];

  // ── Public API ──────────────────────────────────────────────────────────

  window.glLeftRail = {
    init: init,
    updateActive: updateActive,
    NAV_TOP: NAV_TOP,
    NAV_SECTIONS: NAV_SECTIONS,
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

  function _renderNavItem(vitem) {
    var tooltip = vitem.tip || vitem.label;
    return '<button class="gl-rail-item" data-page="' + vitem.page + '"'
      + ' onclick="showPage(\'' + vitem.page + '\')"'
      + ' title="' + tooltip + '">'
      + '<span class="gl-rail-icon" style="position:relative">' + vitem.icon
      + (vitem.page === 'ideas' ? '<span class="gl-rail-badge" id="glRailBandRoomBadge" style="display:none;position:absolute;top:-4px;right:-6px;background:#fbbf24;color:#000;font-size:0.5em;font-weight:800;border-radius:50%;min-width:14px;height:14px;line-height:14px;text-align:center;padding:0 3px;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>' : '')
      + (vitem.page === 'feed' ? '<span class="gl-rail-badge" id="glRailFeedBadge" style="display:none;position:absolute;top:-4px;right:-6px;background:#f59e0b;color:#000;font-size:0.5em;font-weight:800;border-radius:50%;min-width:14px;height:14px;line-height:14px;text-align:center;padding:0 3px;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>' : '')
      + '</span>'
      + '<span class="gl-rail-label">' + vitem.label + '</span>'
      + '</button>';
  }

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

    // Home — top-level, above all sections
    html += '<button class="gl-rail-item gl-rail-item--home" data-page="' + NAV_TOP.page + '"'
      + ' onclick="showPage(\'' + NAV_TOP.page + '\')" title="' + (NAV_TOP.tip || NAV_TOP.label) + '">'
      + '<span class="gl-rail-icon">' + NAV_TOP.icon + '</span>'
      + '<span class="gl-rail-label">' + NAV_TOP.label + '</span></button>';

    // Sections: primary items always visible, secondary collapsed
    for (var s = 0; s < NAV_SECTIONS.length; s++) {
      var section = NAV_SECTIONS[s];
      var visibleItems = section.items; // no mode filtering — all items available

      if (visibleItems.length === 0) continue;

      // Primary section: no title, always expanded
      if (section.primary) {
        html += '<div class="gl-rail-section">';
        for (var pi = 0; pi < visibleItems.length; pi++) {
          html += _renderNavItem(visibleItems[pi]);
        }
        html += '</div>';
        continue;
      }

      // Secondary sections: collapsible with clear heading
      html += '<details class="gl-rail-section gl-rail-section--collapsible">';
      html += '<summary class="gl-rail-section-title" style="cursor:pointer;user-select:none;border-top:1px solid rgba(255,255,255,0.06);margin-top:6px;padding-top:10px;display:flex;align-items:center;gap:4px">'
        + '<span>' + section.title + '</span>'
        + '<span style="font-size:0.7em;opacity:0.4;transition:transform 0.15s" class="gl-rail-chevron">\u25B8</span>'
        + '</summary>';
      for (var vi = 0; vi < visibleItems.length; vi++) {
        html += _renderNavItem(visibleItems[vi]);
      }
      html += '</details>';
    }

    _rail.innerHTML = html;
    _items = _rail.querySelectorAll('.gl-rail-item');
  }

  // ── Band Room badge ────────────────────────────────────────────────────
  // Uses FeedActionState identity for correct vote key matching.
  // Previous version used email prefix which didn't match vote storage format.
  // UNIFIED: Both badges now driven by FeedActionState.computeSummary().
  // The separate Firebase polling badge was removed to prevent disagreement
  // between Band Room and Feed badge counts.
  //
  // On initial page load (before feed data is available), do a lightweight
  // poll-only check to show a badge quickly. Feed will override with
  // accurate counts once it loads.
  async function _updateBandRoomBadgeInit() {
    try {
      var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
      if (fas && fas.getActionCount() > 0) return; // already set by feed
      var db = (typeof firebaseDB !== 'undefined') ? firebaseDB : null;
      if (!db || typeof bandPath !== 'function') return;
      var voteKey = fas ? fas.getMyVoteKey() : null;
      if (!voteKey) return;
      var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
      var snap = await db.ref(bandPath('polls')).orderByChild('ts').limitToLast(10).once('value');
      var val = snap.val();
      var count = 0;
      if (val) {
        Object.values(val).forEach(function(p) {
          if (!p.options || !p.options.length) return;
          var vc = p.votes ? Object.keys(p.votes).length : 0;
          if (vc >= memberCount) return; // fully voted = resolved
          if (!p.votes || p.votes[voteKey] === undefined) count++;
        });
      }
      // Only set if feed hasn't loaded yet
      if (fas && fas.getActionCount() === 0) {
        var badge = document.getElementById('glRailBandRoomBadge');
        if (badge) {
          badge.textContent = count > 9 ? '9+' : String(count);
          badge.style.display = count > 0 ? '' : 'none';
        }
        var feedBadge = document.getElementById('glRailFeedBadge');
        if (feedBadge) {
          feedBadge.textContent = count > 9 ? '9+' : String(count);
          feedBadge.style.display = count > 0 ? '' : 'none';
        }
      }
    } catch(e) {}
  }
  // Quick init badge — feed will override with accurate counts when it loads
  setTimeout(_updateBandRoomBadgeInit, 3000);

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
    if (w < 901) return true; // mobile: rail hidden, hamburger menu
    // Desktop (>=901): check user preference, default collapsed for medium, expanded for large
    var userPref = localStorage.getItem('glNavCollapsed');
    if (userPref !== null) return userPref === '1';
    // Default: collapsed under 1200px, expanded at 1200+
    return w < 1200;
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
    // When collapsed: force secondary <details> open so icon-only items are visible
    // When expanded: close them so the rail isn't overwhelming
    if (_rail) {
      var detailsEls = _rail.querySelectorAll('.gl-rail-section--collapsible');
      detailsEls.forEach(function(d) {
        if (collapsed) {
          d.setAttribute('open', '');
        } else {
          d.removeAttribute('open');
        }
      });
    }
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
