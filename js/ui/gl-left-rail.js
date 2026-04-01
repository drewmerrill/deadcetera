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

  // ── Lucide-style inline SVG icons (18px, stroke-width 1.75, consistent style) ──
  var _s = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var ICONS = {
    home:       '<svg ' + _s + '><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    music:      '<svg ' + _s + '><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    guitar:     '<svg ' + _s + '><path d="m20 7 1.7-1.7a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0L17 4"/><path d="m17 4-5.3 5.3"/><path d="M14.5 6.5a2.1 2.1 0 0 0-3 3L4 17l-1 4 4-1 7.5-7.5a2.1 2.1 0 0 0 3-3z"/></svg>',
    calendar:   '<svg ' + _s + '><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    list:       '<svg ' + _s + '><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>',
    mic:        '<svg ' + _s + '><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
    newspaper:  '<svg ' + _s + '><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>',
    vote:       '<svg ' + _s + '><path d="m9 12 2 2 4-4"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>',
    users:      '<svg ' + _s + '><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    settings:   '<svg ' + _s + '><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    headphones: '<svg ' + _s + '><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>',
    sliders:    '<svg ' + _s + '><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>',
    barChart:   '<svg ' + _s + '><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
    wrench:     '<svg ' + _s + '><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    helpCircle: '<svg ' + _s + '><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    target:     '<svg ' + _s + '><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    bell:       '<svg ' + _s + '><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    dollar:     '<svg ' + _s + '><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    megaphone:  '<svg ' + _s + '><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    trophy:     '<svg ' + _s + '><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    mapPin:     '<svg ' + _s + '><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    gauge:      '<svg ' + _s + '><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
    tuner:      '<svg ' + _s + '><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>',
    drum:       '<svg ' + _s + '><path d="m2 2 8 8"/><path d="m22 2-8 8"/><ellipse cx="12" cy="9" rx="10" ry="5"/><path d="M2 9v5c0 2.8 4.5 5 10 5s10-2.2 10-5V9"/></svg>',
    box:        '<svg ' + _s + '><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
  };

  // ── Nav structure — centralized config ──
  // Each item: { page, icon (SVG string), label, tip, section }
  var NAV_TOP = { page: 'home', icon: ICONS.home, label: 'Home', tip: 'Your band dashboard', color: '#a5b4fc' };

  var NAV_SECTIONS = [
    { title: '', primary: true, items: [
      { page: 'songs',     icon: ICONS.music,    label: 'Songs',     tip: 'Your song library and charts',       color: '#c084fc' },
      { page: 'rehearsal', icon: ICONS.guitar,   label: 'Rehearsal', tip: 'Plan and run your next rehearsal',   color: '#22c55e' },
      { page: 'calendar',  icon: ICONS.calendar, label: 'Schedule',  tip: 'Gigs, rehearsals, and events',      color: '#60a5fa' },
      { page: 'setlists',  icon: ICONS.list,     label: 'Setlists',  tip: 'Build and organize setlists',       color: '#f59e0b' },
    ]},
    { title: 'Band', items: [
      { page: 'gigs',      icon: ICONS.mic,       label: 'Gigs',       tip: 'Manage gigs and performances',    color: '#fbbf24' },
      { page: 'ideas',     icon: ICONS.vote,      label: 'Band Room',  tip: 'Pitch songs, vote, and decisions', color: '#34d399' },
      { page: 'feed',      icon: ICONS.newspaper, label: 'Feed',       tip: 'Band notes and discussions',       color: '#fb923c' },
      { page: 'admin',     icon: ICONS.settings,  label: 'Settings',   tip: 'Band members and settings',        color: '#94a3b8' },
    ]},
    { title: 'Tools', items: [
      { page: 'practice',    icon: ICONS.target,     label: 'Practice',     tip: 'Practice songs and track progress', color: '#f87171' },
      { page: 'playlists',   icon: ICONS.headphones, label: 'Playlists',    tip: 'Practice and learning playlists',   color: '#a78bfa' },
      { page: 'pocketmeter', icon: ICONS.gauge,      label: 'Pocket Meter', tip: 'Timing and groove',                color: '#2dd4bf' },
      { page: 'tuner',       icon: ICONS.tuner,      label: 'Tuner',        tip: 'Tune your instrument',             color: '#38bdf8' },
      { page: 'metronome',   icon: ICONS.drum,       label: 'Metronome',    tip: 'Tempo and click',                  color: '#fb7185' },
      { page: 'stageplot',   icon: ICONS.sliders,    label: 'Stage Plot',   tip: 'Stage layouts',                    color: '#818cf8' },
      { page: 'venues',      icon: ICONS.mapPin,     label: 'Venues',       tip: 'Venue details and logistics',      color: '#4ade80' },
      { page: 'equipment',   icon: ICONS.box,        label: 'Equipment',    tip: 'Gear and setups',                  color: '#a8a29e' },
    ]},
    { title: 'More', items: [
      { page: 'finances',      icon: ICONS.dollar,    label: 'Finances',      tip: 'Income, expenses, payouts',  color: '#34d399' },
      { page: 'social',        icon: ICONS.megaphone, label: 'Social Media',  tip: 'Posts and promotion',        color: '#f472b6' },
      { page: 'bestshot',      icon: ICONS.trophy,    label: 'Best Shot',     tip: 'Best performances',          color: '#fbbf24' },
      { page: 'contacts',      icon: ICONS.users,     label: 'Contacts',      tip: 'Band and venue contacts',    color: '#60a5fa' },
      { page: 'notifications', icon: ICONS.bell,      label: 'Notifications', tip: 'Updates and alerts',         color: '#fb923c' },
      { page: 'help',          icon: ICONS.helpCircle, label: 'Help',         tip: 'Help and guides',            color: '#94a3b8' },
    ]},
  ];

  // ── Public API ──────────────────────────────────────────────────────────

  window.glLeftRail = {
    init: init,
    updateActive: updateActive,
    NAV_TOP: NAV_TOP,
    NAV_SECTIONS: NAV_SECTIONS,
    ICONS: ICONS,
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
    var iconColor = vitem.color || 'currentColor';
    return '<button class="gl-rail-item" data-page="' + vitem.page + '"'
      + ' onclick="showPage(\'' + vitem.page + '\')"'
      + ' title="' + tooltip + '">'
      + '<span class="gl-rail-icon" style="position:relative;color:' + iconColor + '">' + vitem.icon
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
  setInterval(_updateBandRoomBadge, 300000); // was 2min — reduce to 5min for mobile perf

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
