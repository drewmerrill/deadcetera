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

  // Core nav: 5 pages always visible
  var NAV_CORE = [
    { page: 'songs',     icon: '\uD83C\uDFB5', label: 'Songs',     tip: 'Your song library and charts' },
    { page: 'rehearsal', icon: '\uD83C\uDFB8', label: 'Rehearsal', tip: 'Plan and run your next rehearsal' },
    { page: 'calendar',  icon: '\uD83D\uDCC5', label: 'Schedule',  tip: 'Gigs, rehearsals, and events' },
    { page: 'setlists',  icon: '\uD83D\uDCCB', label: 'Setlists',  tip: 'Build and organize setlists' },
  ];

  // All secondary pages — value-weighted ordering for tools drawer
  // Grouped: Quick Tools → Band → Plan & Prep → Admin
  var NAV_MORE = [
    // Quick Tools — event-driven, critical
    { page: 'pocketmeter',   icon: '\u23F1',        label: 'Pocket Meter', tip: 'Live BPM detection', section: 'Quick Tools' },
    { page: 'tuner',         icon: '\uD83C\uDFB8',  label: 'Tuner',        tip: 'Tune your instrument' },
    { page: 'metronome',     icon: '\uD83E\uDD41',  label: 'Metronome',    tip: 'Tempo and click' },
    // Band — collaborative surfaces
    { page: 'gigs',          icon: '\uD83C\uDFA4',  label: 'Gigs',         tip: 'Shows and performances', section: 'Band' },
    { page: 'ideas',         icon: '\uD83D\uDCAC',  label: 'Band Room',    tip: 'Ideas, votes, decisions' },
    { page: 'feed',          icon: '\uD83D\uDCE1',  label: 'Feed',         tip: 'Action items and assignments' },
    { page: 'practice',      icon: '\uD83C\uDFAF',  label: 'Practice',     tip: 'Focus songs and mixes' },
    // Plan & Prep — gig preparation
    { page: 'stageplot',     icon: '\uD83C\uDFAD',  label: 'Stage Plot',   tip: 'Stage layout builder', section: 'Plan & Prep' },
    { page: 'venues',        icon: '\uD83C\uDFDB',  label: 'Venues',       tip: 'Locations and contacts' },
    { page: 'playlists',     icon: '\uD83C\uDFA7',  label: 'Playlists',    tip: 'Listening and learning' },
    { page: 'bestshot',      icon: '\uD83C\uDFC6',  label: 'Best Shot',    tip: 'Performance comparisons' },
    // Admin — infrequent but valuable
    { page: 'equipment',     icon: '\uD83C\uDF9B',  label: 'Equipment',    tip: 'Gear inventory', section: 'Admin' },
    { page: 'finances',      icon: '\uD83D\uDCB0',  label: 'Finances',     tip: 'Income, expenses, payouts' },
    { page: 'notifications', icon: '\uD83D\uDD14',  label: 'Notifications',tip: 'SMS and care packages' },
    { page: 'contacts',      icon: '\uD83D\uDC65',  label: 'Contacts',     tip: 'Booking and venue contacts' },
    { page: 'social',        icon: '\uD83D\uDCE3',  label: 'Social Media', tip: 'Social links and promotion' },
    { page: 'help',          icon: '\u2753',         label: 'Help',         tip: 'Guides and walkthroughs' },
  ];

  // Legacy compat — keep NAV_SECTIONS for any code that reads it
  var NAV_SECTIONS = [
    { title: '', primary: true, items: NAV_CORE },
    { title: 'More', items: NAV_MORE },
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

    var html = '<button class="gl-rail-toggle" title="Collapse navigation">'
      + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">'
      + '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
      + '</svg></button>';

    // Home — top-level
    html += '<button class="gl-rail-item gl-rail-item--home" data-page="' + NAV_TOP.page + '"'
      + ' onclick="showPage(\'' + NAV_TOP.page + '\')" title="' + (NAV_TOP.tip || NAV_TOP.label) + '">'
      + '<span class="gl-rail-icon">' + NAV_TOP.icon + '</span>'
      + '<span class="gl-rail-label">' + NAV_TOP.label + '</span></button>';

    // Core 4 — always visible
    html += '<div class="gl-rail-section">';
    for (var ci = 0; ci < NAV_CORE.length; ci++) {
      html += _renderNavItem(NAV_CORE[ci]);
    }
    html += '</div>';

    // Bottom: Settings + More drawer trigger
    html += '<div class="gl-rail-bottom" style="margin-top:auto;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">';
    html += '<button class="gl-rail-item" data-page="admin" onclick="showPage(\'admin\')" title="Settings">'
      + '<span class="gl-rail-icon">\u2699\uFE0F</span>'
      + '<span class="gl-rail-label">Settings</span></button>';
    html += '<button class="gl-rail-item gl-rail-more-btn" onclick="glOpenToolsDrawer()" title="More tools">'
      + '<span class="gl-rail-icon">\u2022\u2022\u2022</span>'
      + '<span class="gl-rail-label">More</span></button>';
    html += '</div>';

    _rail.innerHTML = html;
    _items = _rail.querySelectorAll('.gl-rail-item');

    // ── Mobile bottom tab bar ──
    _renderBottomTabBar();
  }

  // ── Mobile bottom tab bar — 5 core pages + More ──
  function _renderBottomTabBar() {
    if (document.getElementById('glBottomTabs')) return; // already rendered
    var bar = document.createElement('div');
    bar.id = 'glBottomTabs';
    bar.style.cssText = 'display:none;position:fixed;bottom:0;left:0;right:0;z-index:8000;'
      + 'background:rgba(15,23,42,0.98);border-top:1px solid rgba(255,255,255,0.1);'
      + 'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);'
      + 'padding-bottom:env(safe-area-inset-bottom);'
      + 'align-items:stretch;justify-content:space-around';
    var tabs = [NAV_TOP].concat(NAV_CORE).concat([{ page: '_more', icon: '\u2022\u2022\u2022', label: 'More' }]);
    tabs.forEach(function(t) {
      var onclick = t.page === '_more' ? 'glOpenToolsDrawer()' : 'showPage(\'' + t.page + '\')';
      bar.innerHTML += '<button class="gl-tab" data-page="' + t.page + '" onclick="' + onclick + '" style="'
        + 'background:none;border:none;color:#64748b;display:flex;flex-direction:column;'
        + 'align-items:center;justify-content:center;gap:2px;padding:8px 0 6px;min-width:0;flex:1;'
        + 'cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;'
        + 'min-height:48px;position:relative;transition:color 0.15s">'
        + '<span style="font-size:1.15em;line-height:1;display:block">' + t.icon + '</span>'
        + '<span style="font-size:0.58em;font-weight:600;letter-spacing:0.02em;line-height:1">' + t.label + '</span>'
        + '</button>';
    });
    document.body.appendChild(bar);
    // Inject responsive CSS
    if (!document.getElementById('glTabBarCSS')) {
      var s = document.createElement('style');
      s.id = 'glTabBarCSS';
      s.textContent = '@media(max-width:900px){#glBottomTabs{display:flex!important}'
        + '#gl-left-rail{display:none!important}'
        + '.hamburger{display:none!important}'
        + '.main-content{padding-bottom:calc(62px + env(safe-area-inset-bottom))!important}'
        + '}'
        // Active tab: accent color + subtle pill background
        + '.gl-tab[data-page].gl-tab--active{color:#a5b4fc!important}'
        + '.gl-tab[data-page].gl-tab--active::before{'
        + 'content:"";position:absolute;top:4px;left:50%;transform:translateX(-50%);'
        + 'width:36px;height:36px;border-radius:10px;background:rgba(99,102,241,0.12);z-index:-1}'
        + '.gl-tab[data-page].gl-tab--active span:first-child{transform:scale(1.1)}'
        // Tap feedback
        + '.gl-tab:active{opacity:0.6}';
      document.head.appendChild(s);
    }
    // Update active tab
    _updateBottomTabs(GLStore && GLStore.getActivePage ? GLStore.getActivePage() : 'home');
  }

  function _updateBottomTabs(page) {
    var tabs = document.querySelectorAll('#glBottomTabs .gl-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('gl-tab--active', tabs[i].dataset.page === page);
    }
  }

  // ── Tools drawer — searchable list of all secondary pages ──
  window.glOpenToolsDrawer = function() {
    var existing = document.getElementById('glToolsDrawer');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'glToolsDrawer';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center';
    var sheet = '<div style="background:#1e293b;border-radius:16px 16px 0 0;width:100%;max-width:480px;max-height:70vh;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)">';
    sheet += '<div style="padding:14px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06)">';
    sheet += '<span style="font-weight:700;font-size:0.95em;color:#e2e8f0">Tools & Pages</span>';
    sheet += '<button onclick="document.getElementById(\'glToolsDrawer\').remove()" style="background:none;border:none;color:#64748b;font-size:1.2em;cursor:pointer">\u2715</button></div>';
    sheet += '<input id="glDrawerSearch" type="text" placeholder="Search tools..." oninput="glFilterDrawer(this.value)" style="margin:8px 16px;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;font-size:0.85em;font-family:inherit">';
    sheet += '<div id="glDrawerList" style="overflow-y:auto;padding:4px 12px 12px">';
    var _lastSection = '';
    for (var mi = 0; mi < NAV_MORE.length; mi++) {
      var m = NAV_MORE[mi];
      if (m.section && m.section !== _lastSection) {
        _lastSection = m.section;
        sheet += '<div style="font-size:0.6em;font-weight:800;letter-spacing:0.1em;color:#475569;text-transform:uppercase;padding:10px 10px 4px;margin-top:' + (mi > 0 ? '4px' : '0') + '">' + m.section + '</div>';
      }
      sheet += '<button class="gl-drawer-item" data-label="' + m.label.toLowerCase() + '" onclick="document.getElementById(\'glToolsDrawer\').remove();showPage(\'' + m.page + '\')" style="'
        + 'display:flex;align-items:center;gap:10px;width:100%;padding:12px 10px;background:none;border:none;border-radius:8px;color:#e2e8f0;cursor:pointer;font-size:0.88em;font-family:inherit;text-align:left">'
        + '<span style="font-size:1.3em;width:28px;text-align:center">' + m.icon + '</span>'
        + '<span style="flex:1"><span style="font-weight:600">' + m.label + '</span><br>'
        + '<span style="font-size:0.78em;color:#64748b">' + m.tip + '</span></span>'
        + '</button>';
    }
    // Settings entry for mobile (since gear is in desktop rail only)
    sheet += '<button class="gl-drawer-item" data-label="settings" onclick="document.getElementById(\'glToolsDrawer\').remove();showPage(\'admin\')" style="'
      + 'display:flex;align-items:center;gap:10px;width:100%;padding:12px 10px;background:none;border:none;border-radius:8px;color:#e2e8f0;cursor:pointer;font-size:0.88em;font-family:inherit;text-align:left">'
      + '<span style="font-size:1.3em;width:28px;text-align:center">\u2699\uFE0F</span>'
      + '<span style="flex:1"><span style="font-weight:600">Settings</span><br>'
      + '<span style="font-size:0.78em;color:#64748b">Profile, band, data</span></span>'
      + '</button>';
    sheet += '</div></div>';
    overlay.innerHTML = sheet;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    // Focus search on desktop
    var searchInput = document.getElementById('glDrawerSearch');
    if (searchInput && window.innerWidth > 768) searchInput.focus();
  };

  window.glFilterDrawer = function(q) {
    var lower = q.toLowerCase();
    document.querySelectorAll('.gl-drawer-item').forEach(function(item) {
      item.style.display = (!q || item.dataset.label.indexOf(lower) !== -1) ? 'flex' : 'none';
    });
  };

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
    _updateBottomTabs(page);
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
