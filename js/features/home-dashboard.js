// ============================================================================
// js/features/home-dashboard.js
// GrooveLinx Home Dashboard — Moment-Based Entry Screen
//
// Phase 1: skeleton · homeDataLoad · loadUpcomingGigs · context banner · Play Show card
// Phase 2 (next): Rehearse card · Practice card
// Phase 3 (next): Build Setlist card · dynamic ordering · full Stoner Mode
//
// DEPENDENCIES (all window globals from existing files):
//   loadBandDataFromDrive()            — firebase-service.js
//   toArray()                          — utils.js
//   currentUserEmail                   — firebase-service.js
//   readinessCache, readinessCacheLoaded  — app.js
//   BAND_MEMBERS_ORDERED               — app.js
//   getCurrentMemberReadinessKey()     — app.js
//   readinessColor()                   — app.js
//   showPage()                         — js/ui/navigation.js
//   pageRenderers                      — js/ui/navigation.js
//   sanitizeFirebasePath()             — js/core/utils.js
//   showToast()                        — js/core/utils.js
//
// EXPOSES to window:
//   renderHomeDashboard()
//   refreshHomeDashboard()
//   invalidateHomeCache()
//   homeGoLive(gigId)
//   homeCarePackage(gigId)
//   homeDismissBanner()
//   homeViewSetlist(setlistId)
// ============================================================================

'use strict';

// ── Module-level state ───────────────────────────────────────────────────────

var _homeBundle       = null;   // cached data bundle
var _homeCacheTime    = 0;      // ms timestamp of last load
var _HOME_CACHE_TTL   = 300000; // 5 minutes

var _BANNER_DISMISS_KEY = 'gl_home_banner_dismissed';

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point. Called by navigation.js onShow for the 'home' page.
 * Renders skeleton immediately, then loads data and populates cards.
 */
window.renderHomeDashboard = async function renderHomeDashboard() {
    var container = document.getElementById('page-home');
    if (!container) return;

    // Render skeleton immediately — user sees structure before data loads
    container.innerHTML = _renderSkeletonHTML();

    try {
        var bundle = await _homeDataLoad();
        var context = _computeHomeContext(bundle);
        container.innerHTML = _renderDashboard(bundle, context);
    } catch (err) {
        console.warn('[Home] Load error:', err);
        container.innerHTML = _renderErrorState();
    }
};

/**
 * Re-render from cache if still fresh. Called on visibilitychange return.
 * Falls through to full render if cache is stale.
 */
window.refreshHomeDashboard = function refreshHomeDashboard() {
    var container = document.getElementById('page-home');
    if (!container) return;
    if (_homeBundle && (Date.now() - _homeCacheTime < _HOME_CACHE_TTL)) {
        var context = _computeHomeContext(_homeBundle);
        container.innerHTML = _renderDashboard(_homeBundle, context);
    } else {
        window.renderHomeDashboard();
    }
};

/**
 * Invalidate the data cache. Called as a side effect of saveMyReadiness()
 * in app.js so the home screen reflects readiness changes promptly.
 */
window.invalidateHomeCache = function invalidateHomeCache() {
    _homeBundle   = null;
    _homeCacheTime = 0;
};

// ── CTA event handlers (must be on window for inline onclick) ────────────────

/**
 * Go Live — launch gig mode via the linked setlist name.
 * Uses gigLaunchLinkedSetlist(setlistName) from gigs.js.
 * Falls back to navigating to the Gigs page.
 */
window.homeGoLive = function homeGoLive(linkedSetlist) {
    if (!linkedSetlist) {
        if (typeof window.showPage === 'function') window.showPage('gigs');
        return;
    }
    if (typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(linkedSetlist);
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
        if (typeof window.showToast === 'function') window.showToast('📍 Opening Gigs — tap Go Live');
    }
};

/**
 * Care Package — open the care package flow.
 * Uses carePackageSend('gig') from gigs.js / notifications.js.
 */
window.homeCarePackage = function homeCarePackage() {
    if (typeof window.carePackageSend === 'function') {
        window.carePackageSend('gig');
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
    }
};

/**
 * Dismiss the context banner for this session.
 */
window.homeDismissBanner = function homeDismissBanner() {
    try { sessionStorage.setItem(_BANNER_DISMISS_KEY, '1'); } catch(e) {}
    window.refreshHomeDashboard();
};

/**
 * Navigate to view a setlist by name.
 * Uses gigLaunchLinkedSetlist(name) from gigs.js to open it in gig mode,
 * or falls back to the Setlists page.
 */
window.homeViewSetlist = function homeViewSetlist(linkedSetlist) {
    if (linkedSetlist && typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(linkedSetlist);
    } else if (typeof window.showPage === 'function') {
        window.showPage('setlists');
    }
};

// ── Data loading ─────────────────────────────────────────────────────────────

/**
 * Orchestrates all Firebase reads in parallel.
 * Returns a homeDataBundle object regardless of partial failures.
 * Uses module-level cache — won't re-read within TTL.
 */
async function _homeDataLoad() {
    // Return cache if fresh
    if (_homeBundle && (Date.now() - _homeCacheTime < _HOME_CACHE_TTL)) {
        return _homeBundle;
    }

    // All reads fire simultaneously
    var results = await Promise.allSettled([
        _loadUpcomingGigs(3),          // [0]
        _loadUpcomingPlans(2),         // [1] — stubbed in Phase 1
        _loadSetlistSummaries(),       // [2] — stubbed in Phase 1
        _loadRecentGigHistory()        // [3] — stubbed in Phase 1
    ]);

    var bundle = {
        gigs:          results[0].status === 'fulfilled' ? results[0].value : [],
        plans:         results[1].status === 'fulfilled' ? results[1].value : [],
        setlists:      results[2].status === 'fulfilled' ? results[2].value : [],
        recentSongs:   results[3].status === 'fulfilled' ? results[3].value : [],
        // Readiness: use the already-loaded in-memory cache from app.js
        // (preloadReadinessCache() runs on app init — no extra read needed here)
        readinessCache: (typeof readinessCache !== 'undefined') ? readinessCache : {},
        memberKey:     _getMemberKey()
    };

    _homeBundle   = bundle;
    _homeCacheTime = Date.now();
    return bundle;
}

/**
 * Load upcoming gigs ordered by date ascending, limit n.
 * Gigs are stored via loadBandDataFromDrive('_band','gigs') — same as gigs.js.
 * Returns array of gig objects: { date, venue, linkedSetlist, startTime, arrivalTime, ... }
 */
async function _loadUpcomingGigs(n) {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    var today = _todayStr();
    try {
        var all = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'gigs') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'gigs') || []);
        return all
            .filter(function(g) { return (g.date || '') >= today; })
            .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); })
            .slice(0, n);
    } catch (err) {
        console.warn('[Home] loadUpcomingGigs failed:', err);
        return [];
    }
}

/** Phase 1 stub — Phase 2 implements fully */
async function _loadUpcomingPlans(n) {
    return [];
}

/** Phase 1 stub — Phase 3 implements fully */
async function _loadSetlistSummaries() {
    return [];
}

/** Phase 1 stub — Phase 3 implements fully */
async function _loadRecentGigHistory() {
    return [];
}

// ── Context computation (pure, synchronous) ──────────────────────────────────

/**
 * Compute the home screen context from loaded data.
 * Returns: { bannerType, bannerData, cardOrder }
 *
 * Phase 1: banner logic fully implemented; card scoring returns 0 for
 * cards not yet built (Rehearse, Practice, Setlist). Play Show scoring active.
 */
function _computeHomeContext(bundle) {
    var bannerType = _resolveBannerType(bundle);
    var bannerData = _resolveBannerData(bannerType, bundle);

    var scores = {
        playShow: _scorePlayShowCard(bundle),
        rehearse: 0,    // Phase 2
        practice: 0,    // Phase 2
        setlist:  0     // Phase 3
    };

    var cardOrder = _computeCardOrder(scores, bannerType);

    return { bannerType: bannerType, bannerData: bannerData, cardOrder: cardOrder };
}

/**
 * Determine which banner type to show, if any.
 *
 * Priority 1: gig_today     — a gig is scheduled today
 * Priority 2: rehearsal_today — a practice plan is today (Phase 2)
 * Priority 3: gig_soon      — a gig is within 48 hours
 * null: no banner
 */
function _resolveBannerType(bundle) {
    // Check dismiss flag
    try { if (sessionStorage.getItem(_BANNER_DISMISS_KEY) === '1') return null; } catch(e) {}

    var today = _todayStr();
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) return null;

    if (nextGig.date === today) return 'gig_today';

    var diff = _dayDiff(today, nextGig.date);
    if (diff >= 0 && diff <= 2) return 'gig_soon';

    // rehearsal_today handled in Phase 2 when plans load
    return null;
}

function _resolveBannerData(bannerType, bundle) {
    if (!bannerType) return null;
    return { gig: bundle.gigs && bundle.gigs[0] || null };
}

/**
 * Order cards by score descending.
 * Forced orders apply on gig_today and rehearsal_today.
 */
function _computeCardOrder(scores, bannerType) {
    if (bannerType === 'gig_today') {
        return ['playShow', 'rehearse', 'practice', 'setlist'];
    }
    if (bannerType === 'rehearsal_today') {
        return ['rehearse', 'practice', 'playShow', 'setlist'];
    }
    return Object.entries(scores)
        .sort(function(a, b) { return b[1] - a[1]; })
        .map(function(pair) { return pair[0]; });
}

/** Play Show card context score */
function _scorePlayShowCard(bundle) {
    var gig = bundle.gigs && bundle.gigs[0];
    if (!gig) return 0;
    var diff = _dayDiff(_todayStr(), gig.date);
    if (diff === 0) return 3;
    if (diff <= 1) return 2;
    if (diff <= 7) return 1;
    return 0;
}

// ── Top-level render ─────────────────────────────────────────────────────────

function _renderDashboard(bundle, context) {
    var isStoner = _resolveIsStoner();

    var bannerHTML = context.bannerType
        ? _renderContextBanner(context.bannerType, context.bannerData, isStoner)
        : '';

    var cardsHTML = _renderCardGrid(context.cardOrder, bundle, isStoner);

    return [
        '<div class="home-dashboard">',
        bannerHTML,
        '<div class="home-card-grid">',
        cardsHTML,
        '</div>',
        '</div>'
    ].join('');
}

// ── Context Banner ────────────────────────────────────────────────────────────

function _renderContextBanner(bannerType, bannerData, isStoner) {
    var gig = bannerData && bannerData.gig;
    if (!gig) return '';

    var venueName    = _escHtml(gig.venue || 'Tonight\'s Show');
    var linkedSetlist = gig.linkedSetlist || null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';
    var gigId        = '';  // gigs stored by Drive array index — no stable _id; use linkedSetlist for go-live

    if (bannerType === 'gig_today') {
        var doorsLine = gig.doorsTime ? ' · Doors ' + _escHtml(gig.doorsTime) : '';
        if (isStoner) {
            return [
                '<div class="home-banner home-banner--gig">',
                '  <div class="home-banner__body">',
                '    <span class="home-banner__icon">🎤</span>',
                '    <div class="home-banner__text">',
                '      <strong>' + venueName + '</strong>' + doorsLine,
                '    </div>',
                '    <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live →</button>',
                '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">✕</button>',
                '  </div>',
                '</div>'
            ].join('');
        }
        var readinessSummary = _computeSetlistReadiness(gig, bundle_readinessRef());
        var readinessLine = readinessSummary
            ? '  <div class="home-banner__sub">' + readinessSummary + '</div>'
            : '';
        return [
            '<div class="home-banner home-banner--gig">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">🎤</span>',
            '    <div class="home-banner__text">',
            '      <strong>Tonight: ' + venueName + '</strong>' + doorsLine,
            readinessLine,
            '    </div>',
            '    <div class="home-banner__actions">',
            '      <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live →</button>',
            linkedSetlist ? '      <button class="home-banner__cta home-banner__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">Setlist</button>' : '',
            '    </div>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">✕</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    if (bannerType === 'gig_soon') {
        var diff = _dayDiff(_todayStr(), gig.date || '');
        var daysText = diff === 1 ? 'Tomorrow' : 'In ' + diff + ' days';
        var friendlyDate = gig.date ? _formatDateShort(gig.date) : '';
        return [
            '<div class="home-banner home-banner--soon">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">📅</span>',
            '    <div class="home-banner__text">',
            '      <strong>' + daysText + ': ' + venueName + '</strong>',
            '      <div class="home-banner__sub">' + friendlyDate + ' · Get ready</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--secondary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Prep →</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">✕</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    return '';
}

// ── Card grid ─────────────────────────────────────────────────────────────────

function _renderCardGrid(cardOrder, bundle, isStoner) {
    var renderers = {
        playShow: _renderPlayShowCard,
        rehearse: _renderRehearseCardStub,
        practice: _renderPracticeCardStub,
        setlist:  _renderSetlistCardStub
    };
    return cardOrder.map(function(key) {
        var fn = renderers[key];
        return fn ? fn(bundle, isStoner) : '';
    }).join('');
}

// ── Play Show Card (Phase 1 — fully implemented) ─────────────────────────────

function _renderPlayShowCard(bundle, isStoner) {
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) {
        return _renderCardEmptyState('playShow');
    }

    var gigId          = '';  // no stable ID — Drive array; not used for go-live
    var venueName      = nextGig.venue || 'Upcoming Show';
    var gigDate        = nextGig.date  || '';
    var linkedSetlist  = nextGig.linkedSetlist || null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    var daysUntil  = gigDate ? _dayDiff(_todayStr(), gigDate) : null;
    var isToday    = daysUntil === 0;
    var dateLabel  = _formatDateShort(gigDate);
    var timeLabel  = nextGig.doorsTime ? 'Doors ' + nextGig.doorsTime : '';
    if (nextGig.startTime) timeLabel = (timeLabel ? timeLabel + ' · ' : '') + 'Set ' + nextGig.startTime;

    // ── Stoner Mode ──
    if (isStoner) {
        return [
            '<div class="home-card home-card--playshow">',
            '  <div class="home-card__icon">🎤</div>',
            '  <div class="home-card__label">Play Show</div>',
            '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
            '  <div class="home-card__sub">' + (isToday ? 'Tonight' : dateLabel) + (timeLabel ? ' · ' + _escHtml(timeLabel) : '') + '</div>',
            '  <button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">' + (isToday ? "I'm Ready →" : "View Show →") + '</button>',
            '</div>'
        ].join('');
    }

    // ── Full Mode ──
    var readinessSummary = _computeSetlistReadiness(nextGig, bundle.readinessCache);
    var readinessHTML    = _renderSetlistReadinessBars(nextGig, bundle.readinessCache);
    var warningsHTML     = _renderReadinessWarnings(nextGig, bundle.readinessCache);

    var urgencyClass = isToday ? 'home-card--playshow home-card--urgent' : 'home-card--playshow';

    var ctaGoLive = '<button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">'
        + (isToday ? '🎤 Go Live →' : '🎤 Activate Show') + '</button>';

    var ctaSetlist = linkedSetlist
        ? '<button class="home-card__cta home-card__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">View Setlist</button>'
        : '<button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'gigs\')">Open Gigs</button>';

    var ctaCare = '<button class="home-card__cta home-card__cta--ghost" onclick="homeCarePackage()">📦 Care Package</button>';

    return [
        '<div class="home-card ' + urgencyClass + '">',
        '  <div class="home-card__header">',
        '    <span class="home-card__icon">🎤</span>',
        '    <span class="home-card__label">Play Show</span>',
        '    ' + (isToday ? '<span class="home-card__badge home-card__badge--live">TONIGHT</span>' : (daysUntil !== null && daysUntil <= 2 ? '<span class="home-card__badge home-card__badge--soon">' + (daysUntil === 1 ? 'TOMORROW' : 'IN ' + daysUntil + ' DAYS') + '</span>' : '')),
        '  </div>',
        '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
        '  <div class="home-card__sub">' + dateLabel + (timeLabel ? ' · ' + _escHtml(timeLabel) : '') + '</div>',
        readinessHTML ? ('  <div class="home-card__readiness">' + readinessHTML + '</div>') : '',
        warningsHTML  ? ('  <div class="home-card__warnings">' + warningsHTML + '</div>') : '',
        '  <div class="home-card__actions">',
        '    ' + ctaGoLive,
        '    ' + ctaSetlist,
        '    ' + ctaCare,
        '  </div>',
        '</div>'
    ].join('');
}

// ── Phase 1 stubs for cards built in Phase 2 / Phase 3 ──────────────────────

function _renderRehearseCardStub(bundle, isStoner) {
    return [
        '<div class="home-card home-card--rehearse home-card--stub">',
        '  <div class="home-card__icon">🎼</div>',
        '  <div class="home-card__label">Rehearse</div>',
        '  <div class="home-card__stub-msg">Loading rehearsal data…</div>',
        '</div>'
    ].join('');
}

function _renderPracticeCardStub(bundle, isStoner) {
    return [
        '<div class="home-card home-card--practice home-card--stub">',
        '  <div class="home-card__icon">🎧</div>',
        '  <div class="home-card__label">Practice</div>',
        '  <div class="home-card__stub-msg">Loading practice data…</div>',
        '</div>'
    ].join('');
}

function _renderSetlistCardStub(bundle, isStoner) {
    return [
        '<div class="home-card home-card--setlist home-card--stub">',
        '  <div class="home-card__icon">📋</div>',
        '  <div class="home-card__label">Build Setlist</div>',
        '  <div class="home-card__stub-msg">Loading setlist data…</div>',
        '</div>'
    ].join('');
}

// ── Readiness computation (MVP in-memory) ─────────────────────────────────────

/**
 * Compute a one-line readiness summary for a gig's linked setlist.
 * Returns a string like "Set 1: 5/6 ready · Set 2: 3/5 ready" or null.
 * MVP: uses in-memory readinessCache keyed by song title.
 */
function _computeSetlistReadiness(gig, rc) {
    if (!gig || !gig._setlistSongs) return null;
    rc = rc || {};
    // _setlistSongs expected shape: { set1: ['Song A', 'Song B'], set2: [...] }
    // If not present, skip
    var sets = gig._setlistSongs;
    if (!sets || typeof sets !== 'object') return null;
    var parts = [];
    ['set1', 'set2', 'encore'].forEach(function(setKey) {
        var songs = sets[setKey];
        if (!Array.isArray(songs) || !songs.length) return;
        var ready = songs.filter(function(title) {
            return _bandAvgForSong(rc[title] || {}) >= 3;
        }).length;
        var label = setKey === 'encore' ? 'Encore' : 'Set ' + setKey.replace('set', '');
        parts.push(label + ': ' + ready + '/' + songs.length + ' ready');
    });
    return parts.length ? parts.join(' · ') : null;
}

/**
 * Render per-set readiness bars for a gig, using in-memory readinessCache.
 * Returns HTML string or ''.
 */
function _renderSetlistReadinessBars(gig, rc) {
    if (!gig || !gig._setlistSongs) return '';
    rc = rc || {};
    var sets = gig._setlistSongs;
    if (!sets || typeof sets !== 'object') return '';
    var html = '';
    ['set1', 'set2', 'encore'].forEach(function(setKey) {
        var songs = sets[setKey];
        if (!Array.isArray(songs) || !songs.length) return;
        var ready  = songs.filter(function(t) { return _bandAvgForSong(rc[t] || {}) >= 3; }).length;
        var total  = songs.length;
        var pct    = total ? Math.round((ready / total) * 100) : 0;
        var color  = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
        var label  = setKey === 'encore' ? 'Encore' : 'Set ' + setKey.replace('set', '');
        html += '<div class="home-readiness-row">'
            + '<span class="home-readiness-row__label">' + label + '</span>'
            + '<div class="home-readiness-row__bar"><div class="home-readiness-row__fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
            + '<span class="home-readiness-row__count" style="color:' + color + '">' + ready + '/' + total + '</span>'
            + '</div>';
    });
    return html;
}

/**
 * Render warning lines for songs where 2+ members are below score 2.
 */
function _renderReadinessWarnings(gig, rc) {
    if (!gig || !gig._setlistSongs) return '';
    rc = rc || {};
    var allSongs = [];
    var sets = gig._setlistSongs;
    if (!sets) return '';
    Object.values(sets).forEach(function(arr) {
        if (Array.isArray(arr)) allSongs = allSongs.concat(arr);
    });
    var warnings = allSongs.filter(function(title) {
        var scores = rc[title] || {};
        var lowCount = Object.values(scores).filter(function(s) { return s > 0 && s < 3; }).length;
        return lowCount >= 2;
    });
    if (!warnings.length) return '';
    return '<div class="home-card__warning-list">⚠ Needs work: '
        + warnings.map(function(t) { return _escHtml(t); }).join(', ')
        + '</div>';
}

// ── Empty / error states ──────────────────────────────────────────────────────

function _renderCardEmptyState(cardKey) {
    var configs = {
        playShow: { icon: '🎤', label: 'Play Show', msg: 'No upcoming shows',   cta: 'Add a Gig', action: "showPage('gigs')" },
        rehearse: { icon: '🎼', label: 'Rehearse',  msg: 'No rehearsal scheduled', cta: 'Create Plan', action: "showPage('practice')" },
        practice: { icon: '🎧', label: 'Practice',  msg: 'Sign in to see your practice queue', cta: 'Song Library', action: "showPage('songs')" },
        setlist:  { icon: '📋', label: 'Build Setlist', msg: 'No setlists yet', cta: 'Create Setlist', action: "showPage('setlists')" }
    };
    var cfg = configs[cardKey] || configs.playShow;
    return [
        '<div class="home-card home-card--' + cardKey + ' home-card--empty">',
        '  <div class="home-card__icon">' + cfg.icon + '</div>',
        '  <div class="home-card__label">' + cfg.label + '</div>',
        '  <div class="home-card__empty-msg">' + cfg.msg + '</div>',
        '  <button class="home-card__cta home-card__cta--secondary" onclick="' + cfg.action + '">' + cfg.cta + '</button>',
        '</div>'
    ].join('');
}

function _renderErrorState() {
    return '<div class="home-dashboard home-dashboard--error">'
        + '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
        + '<div style="font-size:2em;margin-bottom:12px">⚠️</div>'
        + '<div>Could not load dashboard. Check connection.</div>'
        + '<button class="btn btn-ghost" style="margin-top:16px" onclick="renderHomeDashboard()">Retry</button>'
        + '</div></div>';
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function _renderSkeletonHTML() {
    var pulse = 'background:rgba(255,255,255,0.06);border-radius:6px;animation:homeSkeletonPulse 1.4s ease-in-out infinite;';
    var cardSkeleton = [
        '<div class="home-card home-card--skeleton">',
        '  <div style="' + pulse + 'height:20px;width:40%;margin-bottom:12px"></div>',
        '  <div style="' + pulse + 'height:14px;width:65%;margin-bottom:8px"></div>',
        '  <div style="' + pulse + 'height:14px;width:50%;margin-bottom:20px"></div>',
        '  <div style="' + pulse + 'height:36px;width:100%;border-radius:8px"></div>',
        '</div>'
    ].join('');
    return [
        '<style>@keyframes homeSkeletonPulse{0%,100%{opacity:0.4}50%{opacity:0.8}}</style>',
        '<div class="home-dashboard">',
        '<div class="home-card-grid">',
        cardSkeleton, cardSkeleton, cardSkeleton, cardSkeleton,
        '</div>',
        '</div>'
    ].join('');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for today in local time */
function _todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

/**
 * Days from dateStrA to dateStrB (positive = B is in the future).
 * Handles YYYY-MM-DD strings. Appends T12:00 to avoid UTC offset issues.
 */
function _dayDiff(dateStrA, dateStrB) {
    if (!dateStrA || !dateStrB) return null;
    try {
        var a = new Date(dateStrA + 'T12:00:00');
        var b = new Date(dateStrB + 'T12:00:00');
        return Math.round((b - a) / 86400000);
    } catch(e) { return null; }
}

/** Format YYYY-MM-DD as "Sat Apr 12" */
function _formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    } catch(e) { return dateStr; }
}

/** Average the numeric values in a score object { drew:3, chris:4, ... } */
function _bandAvgForSong(scoreObj) {
    if (!scoreObj || typeof scoreObj !== 'object') return 0;
    var vals = Object.values(scoreObj).filter(function(v) { return typeof v === 'number' && v > 0; });
    if (!vals.length) return 0;
    return vals.reduce(function(sum, v) { return sum + v; }, 0) / vals.length;
}

/** Escape string for safe HTML insertion */
function _escHtml(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Resolve whether current user should see Stoner Mode */
function _resolveIsStoner() {
    // Phase 1: simple non-signed-in check; Phase 2 will add member preference
    // Bandleader (drew) always gets full mode
    var key = _getMemberKey();
    if (!key) return true;                  // not signed in → simplified view
    // Could check a preference in Firebase later — for now always full for signed-in users
    return false;
}

/** Get the current member key using the same logic as app.js */
function _getMemberKey() {
    if (typeof window.getCurrentMemberKey === 'function') return window.getCurrentMemberKey();
    if (typeof window.getCurrentMemberReadinessKey === 'function') return window.getCurrentMemberReadinessKey();
    return null;
}

/** Reference to the global readinessCache from app.js */
function bundle_readinessRef() {
    return (typeof readinessCache !== 'undefined') ? readinessCache : {};
}

// ── Register with navigation system ─────────────────────────────────────────

// Attach to pageRenderers so showPage('home') triggers the render
if (typeof pageRenderers !== 'undefined') {
    pageRenderers.home = function(el) {
        window.renderHomeDashboard();
    };
}

// visibilitychange: refresh banner check when user returns to tab
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        var container = document.getElementById('page-home');
        if (container && typeof currentPage !== 'undefined' && currentPage === 'home') {
            window.refreshHomeDashboard();
        }
    }
});

console.log('🏠 home-dashboard.js loaded');

// ============================================================================
// CSS — injected into <head> at runtime to keep all home-dashboard code in one file
// ============================================================================

(function _injectHomeDashboardCSS() {
    if (document.getElementById('home-dashboard-css')) return;
    var style = document.createElement('style');
    style.id = 'home-dashboard-css';
    style.textContent = [

        /* ── Layout ── */
        '.home-dashboard { padding: 12px; max-width: 680px; margin: 0 auto; }',
        '.home-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }',
        '@media (max-width: 420px) { .home-card-grid { grid-template-columns: 1fr; } }',

        /* ── Base card ── */
        '.home-card {',
        '  background: var(--bg-card);',
        '  border: 1px solid var(--border);',
        '  border-radius: var(--radius);',
        '  padding: 14px;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 6px;',
        '  transition: border-color 0.15s;',
        '}',
        '.home-card:hover { border-color: rgba(255,255,255,0.16); }',

        /* ── Card header row ── */
        '.home-card__header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }',
        '.home-card__icon { font-size: 1.4em; flex-shrink: 0; }',
        '.home-card__label { font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); flex: 1; }',

        /* ── Card content ── */
        '.home-card__title { font-size: 0.98em; font-weight: 800; color: var(--text); line-height: 1.2; }',
        '.home-card__sub   { font-size: 0.76em; color: var(--text-muted); }',

        /* ── Badges ── */
        '.home-card__badge { font-size: 0.6em; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; }',
        '.home-card__badge--live { background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.35); }',
        '.home-card__badge--soon { background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }',

        /* ── Urgent card accent ── */
        '.home-card--urgent { border-color: rgba(102,126,234,0.4); background: linear-gradient(160deg, var(--bg-card) 60%, rgba(102,126,234,0.06)); }',

        /* ── Readiness bars ── */
        '.home-readiness-row { display: flex; align-items: center; gap: 8px; margin: 2px 0; }',
        '.home-readiness-row__label { font-size: 0.7em; color: var(--text-dim); min-width: 36px; }',
        '.home-readiness-row__bar { flex: 1; height: 5px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }',
        '.home-readiness-row__fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }',
        '.home-readiness-row__count { font-size: 0.7em; font-weight: 700; min-width: 28px; text-align: right; }',

        /* ── Warnings ── */
        '.home-card__warning-list { font-size: 0.72em; color: var(--yellow); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px; }',

        /* ── CTA buttons ── */
        '.home-card__actions { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }',
        '.home-card__cta { width: 100%; padding: 9px 12px; border-radius: 8px; font-size: 0.82em; font-weight: 700; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; text-align: center; }',
        '.home-card__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }',
        '.home-card__cta--primary:hover { opacity: 0.9; }',
        '.home-card__cta--secondary { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-card__cta--secondary:hover { background: rgba(255,255,255,0.1); color: var(--text); }',
        '.home-card__cta--ghost { background: transparent; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.05); font-size: 0.75em; }',
        '.home-card__cta--ghost:hover { background: rgba(255,255,255,0.04); color: var(--text-muted); }',

        /* ── Empty / stub states ── */
        '.home-card--stub { opacity: 0.55; pointer-events: none; }',
        '.home-card--stub .home-card__icon { font-size: 1.1em; }',
        '.home-card__stub-msg { font-size: 0.75em; color: var(--text-dim); font-style: italic; margin-top: 4px; }',
        '.home-card--empty { border-style: dashed; }',
        '.home-card__empty-msg { font-size: 0.78em; color: var(--text-dim); padding: 8px 0; }',

        /* ── Context banner ── */
        '.home-banner { border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; position: relative; }',
        '.home-banner--gig  { background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.12)); border: 1px solid rgba(102,126,234,0.3); }',
        '.home-banner--soon { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }',
        '.home-banner__body { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
        '.home-banner__icon { font-size: 1.3em; flex-shrink: 0; }',
        '.home-banner__text { flex: 1; min-width: 0; font-size: 0.88em; color: var(--text); }',
        '.home-banner__text strong { display: block; font-weight: 800; margin-bottom: 2px; }',
        '.home-banner__sub { font-size: 0.78em; color: var(--text-muted); }',
        '.home-banner__actions { display: flex; gap: 6px; flex-shrink: 0; }',
        '.home-banner__cta { padding: 8px 14px; border-radius: 8px; font-size: 0.8em; font-weight: 700; cursor: pointer; border: none; font-family: inherit; white-space: nowrap; }',
        '.home-banner__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }',
        '.home-banner__cta--secondary { background: rgba(255,255,255,0.08); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-banner__dismiss { position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.75em; padding: 4px; line-height: 1; }',
        '.home-banner__dismiss:hover { color: var(--text-muted); }',

    ].join('\n');
    document.head.appendChild(style);
}());
