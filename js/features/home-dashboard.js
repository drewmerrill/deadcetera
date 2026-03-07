// ============================================================================
// js/features/home-dashboard.js
// GrooveLinx Home Dashboard — Moment-Based Entry Screen
//
// Phase 1: skeleton · homeDataLoad · loadUpcomingGigs · context banner · Play Show card
// Phase 2 (next): Rehearse card · Practice card
// Phase 3 complete: Build Setlist card · dynamic ordering
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
        _triggerDashboardEntrance();
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
        _triggerDashboardEntrance();
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

/**
 * Load upcoming rehearsal events from Firebase (same source as rehearsal.js).
 * Each event: { id, date, time, location, plan: { songs: [...] }, rsvps: {...} }
 */
async function _loadUpcomingPlans(n) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return [];
    var today = _todayStr();
    try {
        var snap = await firebaseDB.ref(window.bandPath('rehearsals')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val)
            .filter(function(e) { return e && e.date && e.date >= today; })
            .sort(function(a, b) { return (a.date||'').localeCompare(b.date||''); })
            .slice(0, n || 2);
    } catch(e) {
        console.warn('[Home] _loadUpcomingPlans failed:', e);
        return [];
    }
}

/** Load all setlists. Returns array of { name, date, venue, sets, songCount }.
 */
async function _loadSetlistSummaries() {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    try {
        var raw = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'setlists') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'setlists') || []);
        return raw.map(function(sl, i) {
            var songCount = (sl.sets || []).reduce(function(acc, s) { return acc + (s.songs || []).length; }, 0);
            return { name: sl.name || 'Untitled', date: sl.date || '', venue: sl.venue || '', sets: sl.sets || [], songCount: songCount, _origIdx: i };
        });
    } catch(e) {
        console.warn('[Home] _loadSetlistSummaries failed:', e);
        return [];
    }
}

/**
 * Load recent gig history — gigs in the past 90 days.
 */
async function _loadRecentGigHistory() {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    try {
        var today = _todayStr();
        var cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
        var cutoffStr = cutoff.toISOString().slice(0, 10);
        var all = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'gigs') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'gigs') || []);
        return all.filter(function(g) { return (g.date || '') >= cutoffStr && (g.date || '') < today; })
                  .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
                  .slice(0, 5);
    } catch(e) { return []; }
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
        rehearse: _scoreRehearseCard(bundle),
        practice: _scorePracticeCard(bundle),
        setlist:  _scoreSetlistCard(bundle)
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

    if (nextGig && nextGig.date === today) return 'gig_today';

    // rehearsal today takes priority over gig_soon
    var nextPlan = bundle.plans && bundle.plans[0];
    if (nextPlan && nextPlan.date === today) return 'rehearsal_today';

    if (nextGig) {
        var diff = _dayDiff(today, nextGig.date);
        if (diff >= 0 && diff <= 2) return 'gig_soon';
    }

    // rehearsal_today handled in Phase 2 when plans load
    return null;
}

function _resolveBannerData(bannerType, bundle) {
    if (!bannerType) return null;
    return {
        gig:  bundle.gigs  && bundle.gigs[0]  || null,
        plan: bundle.plans && bundle.plans[0] || null
    };
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

    var cardsHTML   = _renderCardGrid(context.cardOrder, bundle, isStoner);
    var readinessHTML = _renderBandReadinessScore(bundle);
    var activityHTML  = _renderActivityFeed(bundle);

    return [
        '<div class="home-dashboard">',
        readinessHTML ? readinessHTML.replace('class="home-readiness-widget"', 'class="home-readiness-widget home-anim-header"') : '',
        bannerHTML    ? bannerHTML.replace('class="home-banner', 'class="home-banner home-anim-header') : '',
        '<div class="home-card-grid home-anim-cards">',
        cardsHTML,
        '</div>',
        activityHTML  ? activityHTML.replace('id="home-activity-feed"', 'id="home-activity-feed" style="opacity:0"') : activityHTML,
        '</div>'
    ].join('');
}

// ── Context Banner ────────────────────────────────────────────────────────────

function _renderContextBanner(bannerType, bannerData, isStoner) {
    var gig  = bannerData && bannerData.gig;
    var plan = bannerData && bannerData.plan;

    var venueName    = gig ? _escHtml(gig.venue || 'Tonight\'s Show') : '';
    var linkedSetlist = gig ? (gig.linkedSetlist || null) : null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    if (bannerType === 'rehearsal_today') {
        var loc = plan && plan.location ? ' · 📍 ' + _escHtml(plan.location) : '';
        var time = plan && plan.time ? ' at ' + _escHtml(plan.time) : '';
        var planSongs = plan && plan.plan && Array.isArray(plan.plan.songs) ? plan.plan.songs.length : 0;
        var songsLine = planSongs ? planSongs + ' song' + (planSongs > 1 ? 's' : '') + ' planned' : 'No songs planned yet';
        return [
            '<div class="home-banner home-banner--rehearse">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">🎸</span>',
            '    <div class="home-banner__text">',
            '      <strong>Rehearsal Tonight' + time + '</strong>' + loc,
            '      <div class="home-banner__sub">' + songsLine + '</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan →</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">✕</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

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
        rehearse: _renderRehearseCard,
        practice: _renderPracticeCard,
        setlist:  _renderSetlistCard
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
            '  <div class="home-card__label">Go Live</div>',
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
        '    <span class="home-card__label">Go Live</span>',
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

// ── Phase 2: Rehearse Card ───────────────────────────────────────────────────

function _scoreRehearseCard(bundle) {
    var plans = bundle.plans || [];
    if (!plans.length) return 0;
    var today = _todayStr();
    var next = plans[0];
    if (next.date === today) return 3;
    var diff = _dayDiff(today, next.date);
    if (diff <= 2) return 2;
    return 1;
}

function _renderRehearseCard(bundle, isStoner) {
    var plans = bundle.plans || [];
    var myKey = bundle.memberKey;

    if (!plans.length) {
        return [
            '<div class="home-card home-card--rehearse home-card--empty">',
            '  <div class="home-card__header"><span class="home-card__icon">🎼</span><span class="home-card__label">Rehearse</span></div>',
            '  <div class="home-card__title">No Rehearsals Scheduled</div>',
            '  <div class="home-card__empty-msg">Add a rehearsal to build a practice plan.</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'rehearsal\')">Open Rehearsals</button>',
            '</div>'
        ].join('');
    }

    var next = plans[0];
    var today = _todayStr();
    var isToday = next.date === today;
    var diff = _dayDiff(today, next.date);
    var dateLabel = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(next.date);

    var planSongs = (next.plan && Array.isArray(next.plan.songs)) ? next.plan.songs : [];
    var time = next.time ? ' at ' + _escHtml(next.time) : '';

    var myRsvp = myKey && next.rsvps && next.rsvps[myKey] ? (next.rsvps[myKey].status || '') : '';
    var rsvpBadge = myRsvp === 'yes'
        ? '<span style="color:var(--green);font-size:0.72em;font-weight:700">\u2705 You\'re in</span>'
        : myRsvp === 'maybe'
        ? '<span style="color:var(--yellow);font-size:0.72em;font-weight:700">\u2753 Maybe</span>'
        : myRsvp === 'no'
        ? '<span style="color:var(--red);font-size:0.72em;font-weight:700">\u274C Out</span>'
        : '<span style="color:var(--text-dim);font-size:0.72em">RSVP needed</span>';

    var songsHtml;
    if (planSongs.length) {
        var preview = planSongs.slice(0, 3);
        songsHtml = '<div class="home-card__list">'
            + preview.map(function(t) {
                return '<div class="home-card__list-item">\uD83C\uDFB5 ' + _escHtml(t) + '</div>';
            }).join('')
            + (planSongs.length > 3 ? '<div class="home-card__list-item" style="color:var(--text-dim)">+' + (planSongs.length - 3) + ' more\u2026</div>' : '')
            + '</div>';
    } else {
        songsHtml = '<div class="home-card__sub" style="color:var(--text-dim)">No songs planned yet</div>';
    }

    return [
        '<div class="home-card home-card--rehearse' + (isToday ? ' home-card--urgent' : '') + '">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFBC</span><span class="home-card__label">Rehearse</span>' + rsvpBadge + '</div>',
        '  <div class="home-card__title">' + dateLabel + time + '</div>',
        '  <div class="home-card__sub">' + (next.location ? _escHtml(next.location) : 'Location TBD') + '</div>',
        songsHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
        '</div>'
    ].join('');
}

// ── Phase 2: Practice Card ───────────────────────────────────────────────────

function _scorePracticeCard(bundle) {
    var rc = bundle.readinessCache || {};
    var myKey = bundle.memberKey;
    if (!myKey) return 0;
    var weak = 0;
    Object.values(rc).forEach(function(ratings) {
        var mine = ratings && ratings[myKey];
        if (typeof mine === 'number' && mine > 0 && mine < 3) weak++;
    });
    if (weak >= 5) return 3;
    if (weak >= 2) return 2;
    if (weak >= 1) return 1;
    return 0;
}

function _renderPracticeCard(bundle, isStoner) {
    var rc = bundle.readinessCache || {};
    var myKey = bundle.memberKey;

    if (!myKey) {
        return [
            '<div class="home-card home-card--practice home-card--stub">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
            '  <div class="home-card__title">My Practice Queue</div>',
            '  <div class="home-card__stub-msg">Sign in to see your personal song queue</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'practice\')">Song Library</button>',
            '</div>'
        ].join('');
    }

    var weak = [];
    Object.entries(rc).forEach(function(entry) {
        var title = entry[0];
        var ratings = entry[1] || {};
        var mine = ratings[myKey];
        if (typeof mine === 'number' && mine > 0 && mine < 3) {
            weak.push({ title: title, score: mine });
        }
    });
    weak.sort(function(a, b) { return a.score - b.score; });

    if (!weak.length) {
        return [
            '<div class="home-card home-card--practice">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
            '  <div class="home-card__title">All Caught Up! \uD83D\uDCAA</div>',
            '  <div class="home-card__sub">No songs below your readiness threshold.</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'practice\')">Song Library</button>',
            '</div>'
        ].join('');
    }

    var preview = weak.slice(0, 4);
    var songsHtml = '<div class="home-card__list">'
        + preview.map(function(s) {
            var dot = s.score <= 1 ? '\uD83D\uDD34' : '\uD83D\uDFE1';
            return '<div class="home-card__list-item">' + dot + ' ' + _escHtml(s.title) + '</div>';
        }).join('')
        + (weak.length > 4 ? '<div class="home-card__list-item" style="color:var(--text-dim)">+' + (weak.length - 4) + ' more\u2026</div>' : '')
        + '</div>';

    return [
        '<div class="home-card home-card--practice">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
        '  <div class="home-card__title">' + weak.length + ' Song' + (weak.length > 1 ? 's' : '') + ' Need Work</div>',
        songsHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'practice\')">Go Practice \u2192</button>',
        '</div>'
    ].join('');
}

// ── Phase 3: Setlist Card ────────────────────────────────────────────────────

function _scoreSetlistCard(bundle) {
    var setlists = bundle.setlists || [];
    var gigs = bundle.gigs || [];
    if (!setlists.length) return 0;
    // Check if upcoming gig has no linked setlist
    var nextGig = gigs[0];
    if (nextGig && !nextGig.linkedSetlist) return 2;
    if (nextGig && nextGig.linkedSetlist) return 1;
    return 0;
}

function _renderSetlistCard(bundle, isStoner) {
    var setlists = bundle.setlists || [];
    var gigs = bundle.gigs || [];
    var rc = bundle.readinessCache || {};
    var nextGig = gigs[0];

    if (!setlists.length) {
        return [
            '<div class="home-card home-card--setlist home-card--empty">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83D\uDCCB</span><span class="home-card__label">Setlists</span></div>',
            '  <div class="home-card__title">No Setlists Yet</div>',
            '  <div class="home-card__empty-msg">Build your first setlist for an upcoming show.</div>',
            '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'setlists\')">Create Setlist \u2192</button>',
            '</div>'
        ].join('');
    }

    // Find the most relevant setlist: linked to next gig first, else most recent
    var featured = null;
    if (nextGig && nextGig.linkedSetlist) {
        featured = setlists.find(function(sl) { return sl.name === nextGig.linkedSetlist; }) || null;
    }
    if (!featured) {
        // Most recently dated setlist
        featured = setlists.slice().sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
    }

    var isLinked = nextGig && nextGig.linkedSetlist && featured && featured.name === nextGig.linkedSetlist;
    var totalSongs = featured.songCount || 0;
    var setCount = (featured.sets || []).length;

    // Readiness summary: count songs with band avg >= 3
    var allTitles = [];
    (featured.sets || []).forEach(function(s) {
        (s.songs || []).forEach(function(sg) {
            allTitles.push(typeof sg === 'string' ? sg : (sg.title || ''));
        });
    });
    var readyCount = allTitles.filter(function(t) {
        return _bandAvgForSong(rc[t] || {}) >= 3;
    }).length;
    var readyPct = allTitles.length ? Math.round((readyCount / allTitles.length) * 100) : 0;
    var readyColor = readyPct >= 80 ? 'var(--green)' : readyPct >= 50 ? 'var(--yellow)' : 'var(--red)';

    var subtitle = isLinked
        ? '\uD83C\uDFAF Linked to ' + _escHtml(nextGig.venue || nextGig.date || 'next gig')
        : (featured.date ? '\uD83D\uDCC5 ' + _escHtml(featured.date) + (featured.venue ? ' \u00B7 ' + _escHtml(featured.venue) : '') : '');

    var readinessHtml = allTitles.length ? [
        '<div class="home-readiness-row" style="margin:8px 0 10px">',
        '  <span class="home-readiness-row__label">Ready</span>',
        '  <div class="home-readiness-row__bar"><div class="home-readiness-row__fill" style="width:' + readyPct + '%;background:' + readyColor + '"></div></div>',
        '  <span class="home-readiness-row__count" style="color:' + readyColor + '">' + readyCount + '/' + allTitles.length + '</span>',
        '</div>'
    ].join('') : '';

    var statLine = setCount + ' set' + (setCount !== 1 ? 's' : '') + ' \u00B7 ' + totalSongs + ' songs';

    return [
        '<div class="home-card home-card--setlist' + (isLinked ? ' home-card--urgent' : '') + '">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83D\uDCCB</span><span class="home-card__label">Setlists</span></div>',
        '  <div class="home-card__title">' + _escHtml(featured.name) + '</div>',
        '  <div class="home-card__sub">' + subtitle + '</div>',
        '  <div class="home-card__sub" style="color:var(--text-dim);font-size:0.72em">' + statLine + '</div>',
        readinessHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'setlists\')">Open Setlists \u2192</button>',
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
        playShow: { icon: '🎤', label: 'Go Live',   msg: 'No upcoming shows',   cta: 'Add a Gig', action: "showPage('gigs')" },
        rehearse: { icon: '🎼', label: 'Rehearse',  msg: 'No rehearsal scheduled', cta: 'Open Rehearsals', action: "showPage('rehearsal')" },
        practice: { icon: '🎧', label: 'Practice',  msg: 'Sign in to see your practice queue', cta: 'Open Practice', action: "showPage('practice')" },
        setlist:  { icon: '📋', label: 'Setlists',      msg: 'No setlists yet', cta: 'Create Setlist', action: "showPage('setlists')" }
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

// ── Band Readiness Score ─────────────────────────────────────────────────────

/**
 * Compute overall band readiness as a percentage.
 * Uses in-memory readinessCache: avg all songs where at least one member has rated.
 * A song "counts" if band avg >= 3.
 */
function _computeBandReadinessPct(bundle) {
    var rc = bundle.readinessCache || {};
    var entries = Object.values(rc).filter(function(ratings) {
        return ratings && typeof ratings === 'object' && Object.keys(ratings).length > 0;
    });
    if (!entries.length) return null;
    var ready = entries.filter(function(ratings) {
        return _bandAvgForSong(ratings) >= 3;
    }).length;
    return Math.round((ready / entries.length) * 100);
}

function _renderBandReadinessScore(bundle) {
    var pct = _computeBandReadinessPct(bundle);
    if (pct === null) return '';
    var color = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--yellow)' : 'var(--red)';
    var label = pct >= 80 ? 'Gig ready' : pct >= 55 ? 'Getting there' : 'Needs work';
    return [
        '<div class="home-readiness-widget">',
        '  <div class="home-readiness-widget__header">',
        '    <span class="home-readiness-widget__title">Band Readiness</span>',
        '    <span class="home-readiness-widget__pct" style="color:' + color + '">' + pct + '%</span>',
        '  </div>',
        '  <div class="home-readiness-widget__bar">',
        '    <div class="home-readiness-widget__fill" style="width:' + pct + '%;background:' + color + '"></div>',
        '  </div>',
        '  <div class="home-readiness-widget__label" style="color:' + color + '">' + label + '</div>',
        '</div>'
    ].join('');
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

var _activityFeedCache = null;
var _activityFeedTime  = 0;
var _ACTIVITY_TTL      = 120000; // 2 min

/**
 * Load the activity log from the master file and return the last 5 entries.
 * Called lazily — result cached for 2 minutes.
 */
async function _loadActivityFeed() {
    if (_activityFeedCache && (Date.now() - _activityFeedTime < _ACTIVITY_TTL)) {
        return _activityFeedCache;
    }
    try {
        var log = await window.loadMasterFile('_master_activity_log.json') || [];
        var entries = (Array.isArray(log) ? log : Object.values(log))
            .filter(function(e) { return e && e.action && e.time; })
            .slice(-20)
            .reverse()
            .slice(0, 5);
        _activityFeedCache = entries;
        _activityFeedTime  = Date.now();
        return entries;
    } catch(e) { return []; }
}

var _MEMBER_DISPLAY = {
    'drewmerrill1029@gmail.com': 'Drew',
    'drew': 'Drew', 'chris': 'Chris', 'brian': 'Brian', 'pierce': 'Pierce', 'jay': 'Jay'
};

function _displayName(userOrKey) {
    if (!userOrKey) return 'Someone';
    var direct = _MEMBER_DISPLAY[userOrKey];
    if (direct) return direct;
    var prefix = userOrKey.split('@')[0].toLowerCase();
    for (var k in _MEMBER_DISPLAY) {
        if (prefix.indexOf(k) === 0 || k.indexOf(prefix) === 0) return _MEMBER_DISPLAY[k];
    }
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

var _ACTION_LABELS = {
    readiness_set:    function(e) { return _displayName(e.member || e.user) + ' updated readiness for ' + (e.song || 'a song'); },
    status_change:    function(e) { return _displayName(e.user) + ' marked ' + (e.song||'a song') + ' as ' + (e.details || 'updated'); },
    practice_track:   function(e) { return _displayName(e.user) + ' practiced ' + (e.song || 'a song'); },
    rehearsal_note:   function(e) { return _displayName(e.user) + ' added crib notes to ' + (e.song || 'a song'); },
    harmony_add:      function(e) { return _displayName(e.user) + ' added harmony to ' + (e.song || 'a song'); },
    harmony_edit:     function(e) { return _displayName(e.user) + ' edited harmony on ' + (e.song || 'a song'); },
    part_notes:       function(e) { return _displayName(e.user) + ' added part notes to ' + (e.song || 'a song'); },
    sign_in:          function(e) { return _displayName(e.user) + ' joined the session'; },
};

function _activityLabel(e) {
    var fn = _ACTION_LABELS[e.action];
    if (fn) return fn(e);
    return _displayName(e.user) + ' ' + e.action.replace(/_/g, ' ') + (e.song ? ' · ' + e.song : '');
}

function _activityTimeAgo(isoStr) {
    if (!isoStr) return '';
    try {
        var diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
        if (diff < 2)  return 'just now';
        if (diff < 60) return diff + 'm ago';
        var h = Math.floor(diff / 60);
        if (h < 24)    return h + 'h ago';
        return Math.floor(h / 24) + 'd ago';
    } catch(e) { return ''; }
}

function _renderActivityFeed(bundle) {
    // Feed loads async — render a placeholder and fill in after load
    // Uses a post-render async fill pattern
    setTimeout(function() {
        var el = document.getElementById('home-activity-feed');
        if (!el) return;
        _loadActivityFeed().then(function(entries) {
            if (!entries || !entries.length) {
                el.style.display = 'none';
                return;
            }
            el.innerHTML = [
                '<div class="home-activity__title">Recent Activity</div>',
                entries.map(function(e) {
                    return '<div class="home-activity__item">'
                        + '<span class="home-activity__text">' + _escHtml(_activityLabel(e)) + '</span>'
                        + '<span class="home-activity__time">' + _activityTimeAgo(e.time) + '</span>'
                        + '</div>';
                }).join('')
            ].join('');
        });
    }, 300);

    return '<div id="home-activity-feed" class="home-activity"></div>';
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
// ── Entrance Animation ────────────────────────────────────────────────────────

function _triggerDashboardEntrance() {
    // Readiness bar fill: start from 0 on load
    requestAnimationFrame(function() {
        var fill = document.querySelector('.home-readiness-widget__fill');
        if (fill) {
            var target = fill.style.width;
            fill.style.transition = 'none';
            fill.style.width = '0';
            requestAnimationFrame(function() {
                fill.style.transition = 'width 600ms ease-out';
                fill.style.width = target;
            });
        }

        // Activity feed: fade in after cards settle
        var feed = document.getElementById('home-activity-feed');
        if (feed) {
            setTimeout(function() {
                feed.style.transition = 'opacity 180ms ease-out';
                feed.style.opacity = '1';
            }, 180);
        }
    });
}

// ============================================================================

(function _injectHomeDashboardCSS() {
    if (document.getElementById('home-dashboard-css')) return;
    var style = document.createElement('style');
    style.id = 'home-dashboard-css';
    style.textContent = [

        /* ── Entrance animation keyframes ── */
        '@keyframes glFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
        '@keyframes glFadeIn { from { opacity: 0; } to { opacity: 1; } }',
        '@keyframes glBarFill { from { width: 0 !important; } to { } }',

        /* ── Animation classes ── */
        '.home-anim-header { animation: glFadeIn 180ms ease-out both; }',
        '.home-anim-cards  { animation: glFadeUp 180ms ease-out both; }',
        '.home-anim-feed   { animation: glFadeIn 180ms ease-out both; animation-delay: 180ms; }',
        '.home-anim-bar    { animation: glBarFill 600ms ease-out both; }',

        /* ── Layout ── */
        '.home-dashboard { padding: 12px; max-width: 680px; margin: 0 auto; }',
        '.home-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }',
        '@media (max-width: 420px) { .home-card-grid { grid-template-columns: 1fr; } }',

        /* ── Base card ── */
        '.home-card {',
        '  background: rgba(255,255,255,0.04);',
        '  border: 1px solid rgba(255,255,255,0.12);',
        '  border-radius: var(--radius);',
        '  padding: 14px;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 6px;',
        '  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;',
        '}',
        '.home-card:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }',

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
        '.home-card__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; box-shadow: 0 2px 12px rgba(102,126,234,0.35); }',
        '.home-card__cta--primary:hover { opacity: 0.9; }',
        '.home-card__cta--secondary { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-card__cta--secondary:hover { background: rgba(255,255,255,0.1); color: var(--text); }',
        '.home-card__cta--ghost { background: transparent; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.05); font-size: 0.75em; }',
        '.home-card__cta--ghost:hover { background: rgba(255,255,255,0.04); color: var(--text-muted); }',

        /* ── Band Readiness widget ── */
        '.home-readiness-widget { margin-bottom: 24px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }',
        '.home-readiness-widget__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }',
        '.home-readiness-widget__title { font-size: 0.78em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }',
        '.home-readiness-widget__pct { font-size: 1.1em; font-weight: 800; }',
        '.home-readiness-widget__bar { height: 10px; background: rgba(255,255,255,0.07); border-radius: 5px; overflow: hidden; margin-bottom: 4px; }',
        '.home-readiness-widget__fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }',
        '.home-readiness-widget__label { font-size: 0.72em; color: var(--text-dim); }',

        /* ── Activity feed ── */
        '.home-activity { margin-top: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; min-height: 0; }',
        '.home-activity:empty { display: none; }',
        '.home-activity__title { font-size: 0.72em; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }',
        '.home-activity__item { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }',
        '.home-activity__item:last-child { border-bottom: none; }',
        '.home-activity__text { font-size: 0.8em; color: var(--text-muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.home-activity__time { font-size: 0.7em; color: var(--text-dim); flex-shrink: 0; }',

        /* ── Empty / stub states ── */
        '.home-card--stub { opacity: 0.75; }',
        '.home-card--stub .home-card__icon { font-size: 1.1em; }',
        '.home-card__stub-msg { font-size: 0.72em; color: var(--text-dim); padding: 4px 0 8px 0; }',
        '.home-card--empty { border-style: dashed; }',
        '.home-card__empty-msg { font-size: 0.78em; color: var(--text-dim); padding: 8px 0; }',

        /* ── Context banner ── */
        '.home-banner { border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; position: relative; }',
        '.home-banner--gig  { background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.12)); border: 1px solid rgba(102,126,234,0.3); }',
        '.home-banner--soon { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }',
        '.home-banner--rehearse { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); }',

        /* ── Card list (song previews) ── */
        '.home-card__list { margin: 6px 0 10px 0; display: flex; flex-direction: column; gap: 3px; }',
        '.home-card__list-item { font-size: 0.78em; color: var(--text-muted); padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
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
