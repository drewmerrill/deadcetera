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
        _scheduleWeakSongsFill(bundle);
        _scheduleActionOwedFill();
        _scheduleBandAlignFill();
        _renderHdPollCard();
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
        _scheduleWeakSongsFill(_homeBundle);
        _scheduleActionOwedFill();
        _scheduleBandAlignFill();
        _renderHdPollCard();
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
    var hp = document.getElementById('page-home');
    if (hp && hp.style.display !== 'none' && typeof window.renderHomeDashboard === 'function') {
        window.renderHomeDashboard();
    }
};

// ── CTA event handlers (must be on window for inline onclick) ────────────────

window.homeGoLive = function homeGoLive(setlistIdOrName) {
    if (!setlistIdOrName) {
        if (typeof window.showPage === 'function') window.showPage('gigs');
        return;
    }
    if (typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(setlistIdOrName);
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
        if (typeof window.showToast === 'function') window.showToast('Opening Gigs — tap Go Live');
    }
};

window.homeCarePackage = function homeCarePackage() {
    if (typeof window.carePackageSend === 'function') {
        window.carePackageSend('gig');
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
    }
};

window.homeDismissBanner = function homeDismissBanner() {
    try { sessionStorage.setItem(_BANNER_DISMISS_KEY, '1'); } catch(e) {}
    window.refreshHomeDashboard();
};

window.homeViewSetlist = function homeViewSetlist(setlistIdOrName) {
    if (setlistIdOrName && typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(setlistIdOrName);
    } else if (typeof window.showPage === 'function') {
        window.showPage('setlists');
    }
};

// Deep-link: open the specific gig on the gigs page
window._hdOpenGig = function(venueHint) {
    showPage('gigs');
    // After gigs page renders, try to find and highlight the specific gig
    if (venueHint) {
        setTimeout(function() {
            var cards = document.querySelectorAll('#gigsList .app-card, #gigsList .list-item');
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].textContent.indexOf(venueHint) >= 0) {
                    cards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    cards[i].style.boxShadow = '0 0 0 2px #667eea';
                    setTimeout(function(c) { c.style.boxShadow = ''; }.bind(null, cards[i]), 3000);
                    break;
                }
            }
        }, 400);
    }
};

// Deep-link: open the specific setlist on the setlists page (not live mode)
window._hdViewSetlist = function(setlistName) {
    showPage('setlists');
    if (setlistName) {
        setTimeout(function() {
            // Find the setlist by name and open it for editing
            var slCards = document.querySelectorAll('#page-setlists [onclick*="editSetlist"]');
            for (var i = 0; i < slCards.length; i++) {
                if (slCards[i].textContent.indexOf(setlistName) >= 0) {
                    slCards[i].click();
                    break;
                }
            }
            if (!slCards.length) {
                // Fallback: scroll to setlist by text match
                var items = document.querySelectorAll('#page-setlists .app-card, #page-setlists .list-item');
                for (var j = 0; j < items.length; j++) {
                    if (items[j].textContent.indexOf(setlistName) >= 0) {
                        items[j].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        break;
                    }
                }
            }
        }, 400);
    }
};

// ── Rehearsal preview modal ──────────────────────────────────────────────────
// Zero-friction rehearsal start — no intermediate modal
window._hdShowRehearsalPreview = function() {
    if (typeof _glQuickStartRehearsal === 'function') _glQuickStartRehearsal();
    else if (typeof GLOrchestrator !== 'undefined' && GLOrchestrator.runBandCycle) GLOrchestrator.runBandCycle();
    else showPage('rehearsal');
};

// ── Data loading ─────────────────────────────────────────────────────────────

async function _homeDataLoad() {
    if (_homeBundle && (Date.now() - _homeCacheTime < _HOME_CACHE_TTL)) {
        return _homeBundle;
    }

    var results = await Promise.allSettled([
        _loadUpcomingGigs(3),
        _loadUpcomingPlans(2),
        _loadSetlistSummaries(),
        _loadRecentGigHistory(),
        (typeof loadBandDataFromDrive === 'function') ? loadBandDataFromDrive('_band', 'calendar_events').catch(function(){return [];}) : Promise.resolve([]),
        (typeof GLStore !== 'undefined' && GLStore.getBandInvites) ? GLStore.getBandInvites() : Promise.resolve([])
    ]);

    var bundle = {
        gigs:          results[0].status === 'fulfilled' ? results[0].value : [],
        plans:         results[1].status === 'fulfilled' ? results[1].value : [],
        setlists:      results[2].status === 'fulfilled' ? results[2].value : [],
        recentSongs:   results[3].status === 'fulfilled' ? results[3].value : [],
        _calEvents:    results[4].status === 'fulfilled' ? (Array.isArray(results[4].value) ? results[4].value : Object.values(results[4].value || {})) : [],
        _invites:      results[5].status === 'fulfilled' ? results[5].value : [],
        readinessCache: (typeof readinessCache !== 'undefined') ? readinessCache : {},
        memberKey:     _getMemberKey()
    };

    _homeBundle   = bundle;
    _homeCacheTime = Date.now();
    // Evaluate onboarding state from real data
    if (typeof GLStore !== 'undefined' && GLStore.evaluateOnboardingState) {
        GLStore.evaluateOnboardingState(bundle);
    }
    return bundle;
}

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

// ── Context computation ──────────────────────────────────────────────────────

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

function _resolveBannerType(bundle) {
    try { if (sessionStorage.getItem(_BANNER_DISMISS_KEY) === '1') return null; } catch(e) {}

    var today = _todayStr();
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) return null;

    if (nextGig && nextGig.date === today) return 'gig_today';

    var nextPlan = bundle.plans && bundle.plans[0];
    if (nextPlan && nextPlan.date === today) return 'rehearsal_today';

    if (nextGig) {
        var diff = _dayDiff(today, nextGig.date);
        if (diff >= 0 && diff <= 2) return 'gig_soon';
    }

    return null;
}

function _resolveBannerData(bannerType, bundle) {
    if (!bannerType) return null;
    return {
        gig:  bundle.gigs  && bundle.gigs[0]  || null,
        plan: bundle.plans && bundle.plans[0] || null
    };
}

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
    var mode = (typeof GLStore !== 'undefined' && GLStore.getProductMode) ? GLStore.getProductMode() : 'sharpen';

    // Workflow state from GLStore
    var wf = (typeof GLStore !== 'undefined' && GLStore.getDashboardWorkflowState)
        ? GLStore.getDashboardWorkflowState()
        : { phaseState: {}, currentPhase: 'plan', nextActionLabel: 'Get started', nextActionDescription: '', nextActionTarget: '' };

    // Unified dashboard — one entry point regardless of mode
    // Mode still drives internal logic (readiness, focus songs, etc.) but
    // the user sees one consistent Home screen.
    return _renderLockinDashboard(bundle, wf, isStoner);
}

// ── SHARPEN dashboard: solo practice focus ────────────────────────────────────
function _renderSharpenDashboard(bundle, wf, isStoner) {
    return [
        '<div class="home-dashboard hd-command-center">',
        _renderModeHeader('\uD83D\uDD25', 'Sharpen', 'Your next rehearsal, handled.'),
        _renderNextActionCard(bundle, wf),
        _renderTopSongsToWork(bundle),
        _renderBandScorecard(bundle),
        _renderActionOwedCard(),
        _renderListeningCard('focus', '\uD83C\uDFA7 Practice Your Set', 'Listen to your weakest songs and lock them in'),
        _renderSharpenWeakSongs(bundle),
        '</div>'
    ].join('');
}

// ── Next Up Card — dynamic primary action ────────────────────────────────────
function _renderNextUpCard(msg, sub, cta, highConfidence) {
    var _hasDateContext = msg.indexOf('day') !== -1 || msg.indexOf('today') !== -1 || msg.indexOf('Gig') !== -1 || msg.indexOf('Rehearsal') !== -1 || msg.indexOf('Showtime') !== -1;
    var _scheduleLink = _hasDateContext ? '<div style="margin-top:6px"><button onclick="showPage(\'calendar\')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.72em;text-decoration:underline">View full schedule \u2192</button></div>' : '';

    // ── Inline justification (always visible — no click needed) ──
    var _justification = highConfidence ? _buildJustification() : '';

    // ── Expandable depth (sub detail + progress + plan + momentum) ──
    var _expandHtml = '';
    if (highConfidence) {
        var _innerParts = [];

        // Sub detail (moved behind expansion)
        if (sub) {
            _innerParts.push('<div style="font-size:0.85em;color:#94a3b8;line-height:1.4;margin-bottom:6px">' + _escHtml(sub) + '</div>');
        }

        // Progress signal
        var _progress = _buildProgressSignal();
        if (_progress) _innerParts.push(_progress);

        // Momentum signal
        var _momentum = _buildMomentumSignal();
        if (_momentum) _innerParts.push(_momentum);

        // Action plan steps (conversational, not numbered)
        if (typeof GLInsights !== 'undefined' && GLInsights.getNextAction) {
            var ia = GLInsights.getNextAction();
            if (ia && ia.plan && ia.plan.actionPlan && ia.plan.actionPlan.length > 1) {
                var _planHtml = '<div style="margin-top:6px">';
                ia.plan.actionPlan.forEach(function(step) {
                    _planHtml += '<div style="font-size:0.78em;color:var(--text-dim);padding:2px 0;padding-left:12px;text-indent:-12px">\u2192 ' + _escHtml(step) + '</div>';
                });
                if (ia.plan.estimatedTime) _planHtml += '<div style="margin-top:6px;font-size:0.72em;color:#64748b">\u23F1 About ' + ia.plan.estimatedTime + ' minutes</div>';
                _planHtml += '</div>';
                _innerParts.push(_planHtml);
            }
        }

        if (_innerParts.length) {
            _expandHtml = '<details style="margin-bottom:12px"><summary style="font-size:0.75em;color:#64748b;cursor:pointer;margin-bottom:4px">View plan \u25BC</summary>'
                + '<div style="padding:4px 0">' + _innerParts.join('') + '</div></details>';
        }
    }

    // Low confidence: sub detail stays visible (no expansion needed)
    var _subHtml = '';
    if (!highConfidence && sub) {
        _subHtml = '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:16px;line-height:1.4">' + _escHtml(sub) + '</div>';
    }

    // Commitment state check
    var _committed = false;
    try { _committed = localStorage.getItem('gl_committed_today') === _todayStr(); } catch(e) {}

    // Practice streak
    var _streakHtml = _buildPracticeStreak();

    return '<div style="padding:18px 16px;margin-bottom:12px;border:1px solid rgba(34,197,94,0.2);border-radius:12px;background:linear-gradient(160deg,rgba(34,197,94,0.04),rgba(99,102,241,0.03))">'
        + '<div style="font-size:1.05em;font-weight:800;color:#f1f5f9;margin-bottom:4px;line-height:1.25">' + _escHtml(msg) + '</div>'
        + (_justification ? '<div style="font-size:0.72em;color:#64748b;margin-bottom:10px">' + _justification + '</div>' : '')
        + _subHtml
        + _expandHtml
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<button onclick="' + cta.onclick + '" style="padding:12px 28px;border-radius:10px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:700;font-size:0.92em;cursor:pointer;min-width:200px;box-shadow:0 2px 8px rgba(34,197,94,0.2)">' + _escHtml(cta.label) + '</button>'
        + (highConfidence && !_committed
            ? '<button onclick="_hdCommitToPlan()" style="padding:10px 18px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.06);color:#a5b4fc;font-weight:700;font-size:0.82em;cursor:pointer;white-space:nowrap">\uD83C\uDFAF Lock in this plan</button>'
            : _committed ? '<span style="font-size:0.72em;color:#22c55e;font-weight:600">\u2713 Plan locked for today</span>' : '')
        + '</div>'
        + _streakHtml
        + _buildIntelSignal()
        + _scheduleLink
        + '</div>';
}

// ── Inline justification — one plain-language line explaining why ─────────────
function _buildJustification() {
    var parts = [];

    // Issue count from intelligence
    if (typeof GLInsights !== 'undefined' && GLInsights.getNextAction) {
        var ia = GLInsights.getNextAction();
        if (ia && ia.plan) {
            var types = ia.plan.types || [];
            var typeLabel = { stability: 'fell apart', timing: 'timing issues', pitch: 'pitch problems', transition: 'rough transition', lyrics: 'lyric gaps' };
            var readable = types.map(function(t) { return typeLabel[t] || t; }).slice(0, 2);
            if (readable.length) parts.push(readable.join(' + '));
            else if (ia.plan.problemType && typeLabel[ia.plan.problemType]) parts.push(typeLabel[ia.plan.problemType]);
        }
    }

    // Schedule pressure
    try {
        var _calEvents = (typeof GLStore !== 'undefined' && GLStore.getCalendarEvents) ? GLStore.getCalendarEvents() : [];
        var _today = _todayStr();
        var nextGig = _calEvents.filter(function(e) { return e.type === 'gig' && (e.date || '') >= _today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
        if (nextGig) {
            var days = _dayDiff(_today, nextGig.date);
            if (days <= 7 && days >= 0) parts.push('gig in ' + (days === 0 ? 'today' : days + ' day' + (days > 1 ? 's' : '')));
        }
    } catch(e) {}

    if (!parts.length) return '';
    return parts.join(' \u00B7 ');
}

// ── Intelligence signal — subtle one-line insight under hero CTA ──────────────
function _buildIntelSignal() {
    try {
        // Priority 1: Improvement streak across sessions
        if (typeof GLStore !== 'undefined' && GLStore.getRecentSessionRatings) {
            var ratings = GLStore.getRecentSessionRatings();
            if (ratings && ratings.length >= 2) {
                var streak = 0;
                for (var ri = 0; ri < ratings.length - 1; ri++) {
                    if (ratings[ri] >= ratings[ri + 1]) streak++;
                    else break;
                }
                if (streak >= 2) return '<div style="font-size:0.68em;color:#10b981;margin-top:8px">On a ' + (streak + 1) + '-session improvement streak</div>';
            }
        }

        // Priority 2: Readiness improvement from last session
        if (typeof GLStore !== 'undefined' && GLStore.getSessionReadinessDelta) {
            var delta = GLStore.getSessionReadinessDelta();
            if (delta && delta.avg > 0.1) {
                return '<div style="font-size:0.68em;color:#10b981;margin-top:8px">Last rehearsal: +' + delta.avg.toFixed(1) + ' readiness</div>';
            }
        }

        // Priority 3: Songs improved since last session
        if (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex) {
            var idx = RehearsalAnalysis.getIssueIndex();
            var improving = 0;
            if (idx) Object.keys(idx).forEach(function(k) { if (idx[k].trend === 'improving') improving++; });
            if (improving > 0) return '<div style="font-size:0.68em;color:#10b981;margin-top:8px">You improved ' + improving + ' song' + (improving > 1 ? 's' : '') + ' last session</div>';
        }

        // Priority 4: Rehearsal plan ready
        if (typeof GLInsights !== 'undefined' && GLInsights.getNextAction) {
            var ia = GLInsights.getNextAction();
            if (ia && ia.plan && ia.plan.actionPlan && ia.plan.actionPlan.length) {
                var _songCount = (ia.plan.songs && ia.plan.songs.length) || ia.plan.actionPlan.length;
                return '<div style="font-size:0.68em;color:#475569;margin-top:8px">' + _songCount + '-song rehearsal plan ready</div>';
            }
        }
    } catch(e) {}
    return '';
}

// ── Progress signal — bandmate-voice improvement indicator ────────────────────
function _buildProgressSignal() {
    if (typeof GLInsights === 'undefined' || !GLInsights.getNextAction) return '';
    var ia = GLInsights.getNextAction();
    if (!ia || !ia.song) return '';

    var issueIndex = {};
    if (typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.getIssueIndex) {
        issueIndex = RehearsalAnalysis.getIssueIndex();
    }
    var songIssues = issueIndex[ia.song];
    var avg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(ia.song) : 0;

    if (songIssues && songIssues.count === 1 && avg >= 3) {
        return '<div style="font-size:0.78em;color:#34d399;margin-bottom:6px">\u2191 Almost there \u2014 one last thing to clean up</div>';
    }
    if (songIssues && songIssues.count === 1 && avg >= 2) {
        return '<div style="font-size:0.78em;color:#34d399;margin-bottom:6px">\u2191 Getting close \u2014 finish strong</div>';
    }
    if (avg >= 3.5 && songIssues && songIssues.count > 1) {
        return '<div style="font-size:0.78em;color:#fbbf24;margin-bottom:6px">\u2192 Readiness is decent but the issues keep coming back</div>';
    }
    if (avg > 0 && avg < 2.5 && songIssues && songIssues.count >= 2) {
        return '<div style="font-size:0.78em;color:#f87171;margin-bottom:6px">\u2193 This one needs real work \u2014 slow it down and lock it in</div>';
    }
    if (avg > 0 && avg < 2.5) {
        return '<div style="font-size:0.78em;color:#f87171;margin-bottom:6px">\u2193 Not there yet \u2014 give it a focused block</div>';
    }

    return '';
}

// ── Momentum signal — tracks consistency across sessions ──────────────────────
function _buildMomentumSignal() {
    // Check rehearsal session history for consistency signals
    try {
        if (typeof _rhSessionsCache === 'undefined' || !_rhSessionsCache || _rhSessionsCache.length < 2) return '';
        var recent = _rhSessionsCache.slice(0, 5);
        var rated = recent.filter(function(s) { return s.rating; });
        if (rated.length < 2) return '';

        // Count consecutive "great" or "solid" ratings
        var streak = 0;
        for (var i = 0; i < rated.length; i++) {
            if (rated[i].rating === 'great' || rated[i].rating === 'solid') streak++;
            else break;
        }

        if (streak >= 3) {
            return '<div style="font-size:0.78em;color:#34d399;margin-bottom:6px">\uD83D\uDD25 ' + streak + ' solid sessions in a row \u2014 the band is locked in</div>';
        }
        if (streak === 2) {
            return '<div style="font-size:0.78em;color:#86efac;margin-bottom:6px">\u2714 2 good sessions running \u2014 keep the momentum</div>';
        }
    } catch(e) {}
    return '';
}

// ── Collapsed secondary actions (shown below hero when high confidence) ──────
function _renderIntentCollapsed() {
    var _practiceClick = "window._glFocusMode=true;showPage('songs')";
    return '<div style="display:flex;justify-content:center;gap:16px;margin-bottom:12px;padding:4px 0">'
        + '<button onclick="' + _practiceClick + '" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.72em">\uD83C\uDFB8 Practice</button>'
        + '<span style="color:#334155">\u00B7</span>'
        + '<button onclick="showPage(\'rehearsal\')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.72em">\uD83E\uDD41 Rehearsal</button>'
        + '<span style="color:#334155">\u00B7</span>'
        + '<button onclick="showPage(\'gigs\')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.72em">\uD83C\uDFA4 Gig</button>'
        + '</div>';
}

// ── Secondary Actions — 3 distinct journeys (no overlap) ─────────────────────
function _renderIntentSection() {
    // "Get Better" activates focus mode on Songs page
    var _practiceClick = "window._glFocusMode=true;showPage('songs')";

    var _secBtn = 'flex:1;padding:10px 8px;border-radius:10px;cursor:pointer;text-align:center;font-size:0.78em;font-weight:600';
    return '<div style="display:flex;gap:8px;margin-bottom:12px">'
        + '<button onclick="' + _practiceClick + '" style="' + _secBtn + ';border:1px solid rgba(99,102,241,0.15);background:rgba(99,102,241,0.04);color:#818cf8">\uD83C\uDFB8 Get Better</button>'
        + '<button onclick="showPage(\'rehearsal\')" style="' + _secBtn + ';border:1px solid rgba(34,197,94,0.15);background:rgba(34,197,94,0.04);color:#86efac">\uD83E\uDD41 Start Rehearsal</button>'
        + '<button onclick="if(typeof gigLaunchLinkedSetlist===\'function\'){var sl=(window._glCachedSetlists||[]);if(sl.length)gigLaunchLinkedSetlist(sl[0].name);else showPage(\'gigs\');}else showPage(\'gigs\')" style="' + _secBtn + ';border:1px solid rgba(245,158,11,0.15);background:rgba(245,158,11,0.04);color:#fbbf24">\uD83C\uDFA4 Play a Gig</button>'
        + '</div>';
}

// ── Next Action Card — single dominant CTA based on state ────────────────────
function _renderNextActionCard(bundle, wf) {
    var hasSongs = (typeof allSongs !== 'undefined') && allSongs.length > 0;
    var hasSetlist = bundle.setlists && bundle.setlists.length > 0;
    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { primary: null, list: [], reason: '', count: 0 };
    var _focusPrimary = focus.primary ? (typeof focus.primary === 'string' ? focus.primary : (focus.primary.title || 'Untitled Song')) : null;
    var _focusList = (focus.list || []).map(function(s) { return typeof s === 'string' ? s : (s.title || 'Untitled Song'); });
    var weakCount = focus.count;
    var nextGig = bundle.gigs && bundle.gigs[0];
    var daysOut = nextGig ? _dayDiff(_todayStr(), nextGig.date) : 999;
    var dna = (typeof GLOrchestrator !== 'undefined' && GLOrchestrator.getBandDNA) ? GLOrchestrator.getBandDNA() : {};
    var sessionCount = dna.sessionCount || 0;

    var _msg = '', _sub = '', _cta = null;
    var _highConfidence = false; // true when hero card has a specific, directive action

    // Load upcoming rehearsal event
    var _upcomingRehearsal = null;
    try {
        var _calEvents = (typeof GLStore !== 'undefined' && GLStore.getCalendarEvents) ? GLStore.getCalendarEvents() : [];
        if (!_calEvents.length && bundle._calEvents) _calEvents = bundle._calEvents;
        var _today = _todayStr();
        _upcomingRehearsal = _calEvents.filter(function(e) { return e.type === 'rehearsal' && (e.date || '') >= _today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0] || null;
    } catch(e) {}
    var _rehearsalDays = _upcomingRehearsal ? _dayDiff(_todayStr(), _upcomingRehearsal.date) : 999;

    // ── Priority 1: Setup (no songs or setlist) ──
    if (!hasSongs && !hasSetlist) {
        _msg = 'Pick a few songs to get started';
        _sub = 'I\u2019ll shape them into a rehearsal set.';
        _cta = { label: 'Pick Songs \u2192', onclick: "showPage('setlists');setTimeout(function(){if(typeof createNewSetlist==='function')createNewSetlist();},300)" };
    } else if (!hasSetlist) {
        _msg = 'Build your set';
        _sub = 'You\u2019ve got songs. Let\u2019s turn them into a rehearsal set.';
        _cta = { label: 'Build Set \u2192', onclick: "showPage('setlists');setTimeout(function(){if(typeof createNewSetlist==='function')createNewSetlist();},300)" };

    // ── Priority 2: Gig today ──
    } else if (daysOut === 0) {
        _msg = 'Showtime';
        _sub = (nextGig.venue || 'Gig') + ' is today. You\u2019re ready.';
        _cta = { label: '\u25B6 Play Set', onclick: "hdPlayBundle('gig')" };
        _highConfidence = true;

    // ── Priority 3: Intelligence-driven — specific song + issue ──
    } else if (typeof GLInsights !== 'undefined' && GLInsights.getNextAction && GLInsights.getNextAction()) {
        var ia = GLInsights.getNextAction();
        _msg = ia.headline;
        _sub = ia.detail || '';
        var _timeHint = (ia.plan && ia.plan.estimatedTime) ? ' \u00B7 ~' + ia.plan.estimatedTime + ' min' : '';
        if (ia.cta === 'Start Practice' && ia.song) {
            _cta = { label: '\u25B6 Practice Now' + _timeHint, onclick: "selectSong('" + _escHtml(ia.song).replace(/'/g, "\\'") + "')" };
        } else {
            _cta = { label: '\uD83C\uDFB8 Start Rehearsal' + _timeHint, onclick: "showPage('rehearsal')" };
        }
        _highConfidence = true;

    // ── Priority 4: Schedule urgency ──
    } else if (daysOut <= 3 && daysOut > 0 && weakCount > 0) {
        var _songNames = _focusList.slice(0, 3).join(', ');
        _msg = 'Gig in ' + daysOut + ' day' + (daysOut > 1 ? 's' : '') + ' \u2014 focus on ' + (weakCount <= 3 ? _songNames : weakCount + ' songs');
        _sub = 'Based on upcoming gig + weak songs' + (weakCount > 3 ? ' (' + _songNames + ' + ' + (weakCount - 3) + ' more)' : '');
        _cta = { label: '\u25B6 Start Rehearsal', onclick: "showPage('rehearsal')" };
        _highConfidence = true;
    } else if (daysOut <= 3 && daysOut > 0) {
        _msg = 'Gig in ' + daysOut + ' day' + (daysOut > 1 ? 's' : '') + ' \u2014 your set is tight. Run it.';
        _sub = '';
        _cta = { label: '\u25B6 Run the Set', onclick: "hdPlayBundle('gig')" };
        _highConfidence = true;
    } else if (_rehearsalDays <= 3 && _rehearsalDays >= 0 && weakCount > 0) {
        var _rSongNames = _focusList.slice(0, 3).join(', ');
        _msg = 'Rehearsal ' + (_rehearsalDays === 0 ? 'today' : 'in ' + _rehearsalDays + ' day' + (_rehearsalDays > 1 ? 's' : '')) + ' \u2014 focus on ' + (weakCount <= 3 ? _rSongNames : weakCount + ' songs');
        _sub = 'Based on upcoming rehearsal + weak songs' + (weakCount > 3 ? ' (' + _rSongNames + ' + ' + (weakCount - 3) + ' more)' : '');
        _cta = { label: '\u25B6 Start Rehearsal', onclick: "showPage('rehearsal')" };
        _highConfidence = true;
    } else if (_rehearsalDays <= 3 && _rehearsalDays >= 0) {
        _msg = 'Rehearsal ' + (_rehearsalDays === 0 ? 'today' : 'in ' + _rehearsalDays + ' day' + (_rehearsalDays > 1 ? 's' : '')) + ' \u2014 your set is tight. Run it.';
        _sub = '';
        _cta = { label: '\u25B6 Start Rehearsal', onclick: "showPage('rehearsal')" };
        _highConfidence = true;

    // ── Priority 5: Default (still directive, not passive) ──
    } else {
        if (sessionCount === 0) {
            _msg = 'Run your full set end-to-end for the first time';
            _sub = 'One run-through and you\u2019ll know exactly what to work on.';
        } else if (weakCount > 0) {
            var _defNames = _focusList.slice(0, 2).join(' + ');
            _msg = weakCount <= 2 ? 'Work on ' + _defNames : 'Stay sharp \u2014 ' + weakCount + ' songs need reps';
            _sub = weakCount > 2 ? _defNames + ' + ' + (weakCount - 2) + ' more' : 'A quick run keeps everything locked in.';
        } else {
            _msg = 'Run your set to stay tight';
            _sub = 'Everything\u2019s solid. One more run keeps it there.';
        }
        _cta = { label: '\u25B6 Start Rehearsal', onclick: "showPage('rehearsal')" };
    }

    // Hero card only — secondary suggestions handled by dashboard layout
    return _renderNextUpCard(_msg, _sub, _cta, _highConfidence);

    // ── Below: retained for gig-day override (not shown by default) ──────
    if (false) { // gig-day logic preserved but disabled — can re-enable later
    var nextGig = bundle.gigs && bundle.gigs[0];
    var daysOut = nextGig ? _dayDiff(_todayStr(), nextGig.date) : 999;
    var practiced = _didPracticeToday();
    var action = null;

    if (!action) {
        if (daysOut === 0) {
            action = { icon: '\uD83C\uDFA4', title: 'Showtime', sub: nextGig.venue || 'Today', cta: 'Go Live', onclick: 'homeGoLive(\'' + _escHtml(nextGig.name || nextGig.venue || '') + '\')' };
        } else if (daysOut <= 2 && daysOut > 0) {
            action = { icon: '\u26A1', title: 'Gig in ' + daysOut + ' day' + (daysOut > 1 ? 's' : ''), sub: (nextGig.venue || '') + ' \u2014 run the set', cta: 'Practice Set', onclick: 'hdPlayBundle(\'gig\')' };
        } else if (wf && wf.nextActionLabel && wf.nextActionTarget) {
            action = { icon: '\uD83C\uDFAF', title: wf.nextActionLabel, sub: wf.nextActionDescription || '', cta: 'Go', onclick: 'showPage(\'' + wf.nextActionTarget + '\')' };
        } else {
            var weakCount2 = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus().count : 0;
            if (weakCount2 > 0) {
                action = { icon: '\uD83D\uDD25', title: weakCount2 + ' song' + (weakCount2 > 1 ? 's' : '') + ' need work', sub: 'Focus on your weakest songs first', cta: 'Start Practicing', onclick: 'hdPlayBundle(\'focus\')' };
            } else {
                action = { icon: '\uD83D\uDCAA', title: 'You\'re in good shape', sub: 'Keep it tight \u2014 run through the set', cta: 'Practice Set', onclick: 'hdPlayBundle(\'gig\')' };
            }
        }
    }

    if (!action) return runMyBandCard;

    var borderColor = action.completed ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.25)';
    var bgGradient = action.completed ? 'linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,185,129,0.04))' : 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.04))';
    var btnBg = action.completed ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)';
    var labelColor = action.completed ? '#22c55e' : '#818cf8';

    var html = '<div class="app-card" style="padding:16px;margin-bottom:12px;border:1px solid ' + borderColor + ';background:' + bgGradient + '">'
        + '<div style="display:flex;align-items:center;gap:12px">'
        + '<div style="width:44px;height:44px;border-radius:12px;background:' + (action.completed ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)') + ';display:flex;align-items:center;justify-content:center;font-size:1.3em;flex-shrink:0">' + action.icon + '</div>'
        + '<div style="flex:1;min-width:0">'
        + (action.completed ? '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.08em;color:' + labelColor + ';text-transform:uppercase;margin-bottom:2px">Done Today</div>' : '')
        + '<div style="font-size:1em;font-weight:800;color:var(--text)">' + _escHtml(action.title) + '</div>'
        + (action.sub ? '<div style="font-size:0.78em;color:var(--text-dim);margin-top:1px">' + _escHtml(action.sub) + '</div>' : '')
        + '</div>'
        + '<button onclick="' + action.onclick + '" style="padding:10px 18px;border-radius:10px;border:none;background:' + btnBg + ';color:white;font-weight:800;font-size:0.85em;cursor:pointer;white-space:nowrap">' + _escHtml(action.cta) + '</button>'
        + '</div></div>';

    // Progression indicator
    html += _renderProgressionSignal(bundle);

    // Prepend Run My Band card for non-beginners
    return runMyBandCard + html;
    } // end if(false) gig-day block
}

// ── Progression + Band Activity Signals ──────────────────────────────────────
function _renderProgressionSignal(bundle) {
    var signals = [];
    var milestones = [];

    // ── Personal signals ──
    var weekActions = _getActionsThisWeek();
    var practiceCount = weekActions.filter(function(a) { return a.type === 'practice_set' || a.type === 'practice_all'; }).length;
    if (practiceCount > 0) signals.push({ text: '\uD83C\uDFB5 ' + practiceCount + ' practice session' + (practiceCount > 1 ? 's' : '') + ' this week', type: 'personal' });

    // Streak detection
    var streak = _getPracticeStreak();
    if (streak >= 5) milestones.push({ icon: '\uD83D\uDD25', text: streak + '-day practice streak!', color: '#ef4444' });
    else if (streak >= 3) milestones.push({ icon: '\u26A1', text: streak + '-day streak \u2014 keep it going', color: '#fbbf24' });

    // ── Band signals ──
    // Rehearsal sessions this week (shared data from Firebase)
    try {
        if (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache && _rhSessionsCache.length > 0) {
            var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
            var weekSessions = _rhSessionsCache.filter(function(s) { return (s.date || '') >= weekAgo; });
            if (weekSessions.length > 0) {
                signals.push({ text: '\uD83C\uDFB8 Band rehearsed ' + weekSessions.length + ' time' + (weekSessions.length > 1 ? 's' : '') + ' this week', type: 'band' });
            }

            // Band momentum: last 5 ratings as visual
            var rated = _rhSessionsCache.filter(function(s) { return s.rating; }).slice(0, 5);
            if (rated.length >= 2) {
                var ratingValues = { great: 3, solid: 2, needs_work: 1 };
                var ratingIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };
                var dots = rated.map(function(s) { return ratingIcons[s.rating] || '\u25CB'; }).reverse().join('');
                var recentAvg = rated.slice(0, Math.ceil(rated.length / 2)).reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / Math.ceil(rated.length / 2);
                var olderAvg = rated.slice(Math.ceil(rated.length / 2)).reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / (rated.length - Math.ceil(rated.length / 2));
                var trendLabel = '', trendColor = '';
                if (recentAvg > olderAvg + 0.3) { trendLabel = '\u2191 Improving'; trendColor = '#22c55e'; }
                else if (recentAvg < olderAvg - 0.3) { trendLabel = '\u2193 Needs attention'; trendColor = '#fbbf24'; }
                else { trendLabel = '\u2192 Steady'; trendColor = '#94a3b8'; }
                signals.push({ text: 'Band momentum: ' + dots + ' <span style="color:' + trendColor + '">' + trendLabel + '</span>', type: 'band', html: true });
            }
        }
    } catch(e) {}

    // Active members (check readiness updates this week)
    try {
        var rc = bundle.readinessCache || {};
        var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var activeMembers = 0;
        var weekAgoDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        // Count members who have any readiness scores (proxy for activity)
        members.forEach(function(m) {
            var hasScores = false;
            Object.keys(rc).forEach(function(song) {
                if (rc[song] && rc[song][m.key] && rc[song][m.key] > 0) hasScores = true;
            });
            if (hasScores) activeMembers++;
        });
        if (activeMembers > 1 && members.length > 1) {
            signals.push({ text: '\uD83D\uDC65 ' + activeMembers + ' of ' + members.length + ' members active', type: 'band' });
        }
    } catch(e) {}

    // ── Milestones ──
    var _focusMilestone = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { count: 0 };
    if (_focusMilestone.count === 0) milestones.push({ icon: '\uD83D\uDD12', text: 'All songs locked in \u2014 band is ready', color: '#22c55e' });

    // All members rated above threshold
    try {
        var rc2 = bundle.readinessCache || {};
        var allSongsList = (typeof allSongs !== 'undefined') ? allSongs : [];
        var aboveThreshold = 0;
        var totalActive = 0;
        allSongsList.forEach(function(s) {
            if (typeof GLStore === 'undefined' || !GLStore.isActiveSong(s.title)) return;
            totalActive++;
            var avg = GLStore.avgReadiness(s.title);
            if (avg >= 4) aboveThreshold++;
        });
        if (totalActive > 0 && aboveThreshold >= totalActive * 0.8 && aboveThreshold > 5) {
            milestones.push({ icon: '\uD83C\uDFC6', text: '80%+ of songs at gig-ready level', color: '#a5b4fc' });
        }
    } catch(e) {}

    if (!signals.length && !milestones.length) return '';

    var html = '';

    // Milestones first (celebratory)
    if (milestones.length) {
        html += milestones.map(function(m) {
            return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">'
                + '<span style="font-size:1em">' + m.icon + '</span>'
                + '<span style="font-size:0.78em;font-weight:700;color:' + m.color + '">' + m.text + '</span>'
                + '</div>';
        }).join('');
    }

    // Signal chips
    if (signals.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
        html += signals.map(function(s) {
            var content = s.html ? s.text : _escHtml(s.text);
            var borderColor = s.type === 'band' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)';
            return '<div style="font-size:0.7em;font-weight:600;color:#94a3b8;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid ' + borderColor + '">' + content + '</div>';
        }).join('');
        html += '</div>';
    }

    return html;
}

// ── Practice Streak ─────────────────────────────────────────────────────────
function _getPracticeStreak() {
    try {
        var log = JSON.parse(localStorage.getItem(_ACTION_LOG_KEY) || '{}');
        var streak = 0;
        var d = new Date();
        for (var i = 0; i < 30; i++) {
            var dateStr = d.toISOString().split('T')[0];
            var dayActions = log[dateStr] || [];
            var practiced = dayActions.some(function(a) { return a.type === 'practice_set' || a.type === 'practice_all' || a.type === 'rehearsal'; });
            if (practiced) streak++;
            else if (i > 0) break; // streak broken (skip today if no practice yet)
            d.setDate(d.getDate() - 1);
        }
        return streak;
    } catch(e) { return 0; }
}

// ── Top Songs to Work ────────────────────────────────────────────────────────
function _renderTopSongsToWork(bundle) {
    // Use focus engine — single source of truth
    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var songs = focus.list.slice(0, 3);
    if (!songs.length) return '';

    var html = '<div class="app-card" style="padding:12px 14px;margin-bottom:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:0.78em;font-weight:800;color:var(--text)">These need work</div>';
    html += '<button onclick="window._glFocusMode=true;showPage(\'songs\')" style="font-size:0.72em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:none;background:rgba(99,102,241,0.12);color:#a5b4fc">\u25B6 Practice These</button>';
    html += '</div>';

    songs.forEach(function(s, i) {
        var urgency = s.avg <= 2 ? '#ef4444' : s.avg <= 3 ? '#fbbf24' : '#94a3b8';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)">';
        html += '<span style="width:6px;height:6px;border-radius:50%;background:' + urgency + ';flex-shrink:0"></span>';
        html += '<span style="font-size:0.85em;font-weight:600;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escHtml(s.title) + '</span>';
        html += '</div>';
    });

    html += '</div>';
    return html;
}

// _getWeakSongs / _countWeakSongs removed — use GLStore.getNowFocus()

// ── Listening Card ──────────────────────────────────────────────────────────
// One-tap listening bundle launcher. Shows destination chooser if multiple
// destinations configured, otherwise launches directly.

function _renderListeningCard(bundleType, title, subtitle) {
    var lb = (typeof ListeningBundles !== 'undefined') ? ListeningBundles : null;
    if (!lb) return '';

    var ps = (typeof PlaybackSession !== 'undefined') ? PlaybackSession : null;
    var spotifyLabel = ps ? ps.getSpotifyLabel(bundleType) : '\uD83C\uDFB5 Spotify';
    var spotifyStyle = ps ? ps.getSpotifyStyle(bundleType) : 'border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)';
    var spotifyAction = 'ListeningBundles.syncToSpotify(\'' + bundleType + '\')';

    return '<div class="app-card home-anim-cards" style="border-left:3px solid rgba(99,102,241,0.2)">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
        + '<span style="font-size:1em">' + title.split(' ')[0] + '</span>'
        + '<span style="font-size:0.85em;font-weight:700;color:var(--text)">' + _escHtml(title.substring(title.indexOf(' ') + 1)) + '</span>'
        + '</div>'
        + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">' + _escHtml(subtitle) + '</div>'
        + '<div id="hdListenReady_' + bundleType + '" style="font-size:0.72em;color:#64748b;margin-bottom:8px"></div>'
        // Primary CTA
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'
        + '<button id="hdStartSet_' + bundleType + '" onclick="hdPlayBundle(\'' + bundleType + '\')" style="display:flex;align-items:center;gap:4px;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:700;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.12);color:#a5b4fc">\u25B6 Start Set</button>'
        + '<button onclick="' + spotifyAction + '" style="display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.72em;font-weight:600;' + spotifyStyle + '">' + spotifyLabel + '</button>'
        + '</div>'
        // Secondary destinations
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button onclick="ListeningBundles.quickLaunch(\'' + bundleType + '\',\'youtube\')" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim)">\uD83D\uDCFA YouTube</button>'
        + '<button onclick="ListeningBundles.quickLaunch(\'' + bundleType + '\',\'archive\')" style="display:flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim)">\uD83C\uDFDB\uFE0F Archive</button>'
        + '</div>'
        + '<div style="font-size:0.68em;color:#475569;margin-top:6px">We\u2019ll start with your first song and guide you through the set.</div>'
        + '</div>';
}

// ── Action Completion Tracking ──────────────────────────────────────────────
// Lightweight localStorage tracker: what did the user do today?

var _ACTION_LOG_KEY = 'gl_action_log';

function _logAction(actionType) {
    try {
        var log = JSON.parse(localStorage.getItem(_ACTION_LOG_KEY) || '{}');
        var today = _todayStr();
        if (!log[today]) log[today] = [];
        log[today].push({ type: actionType, ts: Date.now() });
        var keys = Object.keys(log).sort();
        while (keys.length > 14) { delete log[keys.shift()]; }
        localStorage.setItem(_ACTION_LOG_KEY, JSON.stringify(log));
    } catch(e) {}
}

// ── Activation Tracking ─────────────────────────────────────────────────────
// Lightweight localStorage signals — no backend needed.
// Read these from console: GLActivation.report()

var _ACT_KEY = 'gl_activation';

function _logActivation(event) {
    try {
        var data = JSON.parse(localStorage.getItem(_ACT_KEY) || '{}');
        if (!data.events) data.events = [];
        data.events.push({ e: event, ts: Date.now() });
        // Track specific milestones
        if (event === 'first_run_started' && !data.firstRunTs) data.firstRunTs = Date.now();
        if (event === 'first_playback' && !data.firstPlaybackTs) data.firstPlaybackTs = Date.now();
        if (event === 'second_action' && !data.secondActionTs) data.secondActionTs = Date.now();
        if (event === 'return_session' && !data.returnTs) data.returnTs = Date.now();
        localStorage.setItem(_ACT_KEY, JSON.stringify(data));
    } catch(e) {}
}

window.GLActivation = {
    report: function() {
        try {
            var data = JSON.parse(localStorage.getItem(_ACT_KEY) || '{}');
            var events = data.events || [];

            var r = { totalEvents: events.length };
            if (data.firstRunTs) r.firstRunAt = new Date(data.firstRunTs).toLocaleString();
            if (data.firstPlaybackTs) {
                r.firstPlaybackAt = new Date(data.firstPlaybackTs).toLocaleString();
                if (data.firstRunTs) r.timeToFirstPlayback = Math.round((data.firstPlaybackTs - data.firstRunTs) / 1000) + 's';
            }
            if (data.secondActionTs) {
                r.secondActionAt = new Date(data.secondActionTs).toLocaleString();
                if (data.firstPlaybackTs) r.timeToSecondAction = Math.round((data.secondActionTs - data.firstPlaybackTs) / 1000) + 's';
            }
            if (data.returnTs) r.returnAt = new Date(data.returnTs).toLocaleString();

            // Hesitation: events with > 10s gap
            var hesitations = [];
            for (var i = 1; i < events.length; i++) {
                var gap = events[i].ts - events[i - 1].ts;
                if (gap > 10000) hesitations.push({ after: events[i - 1].e, before: events[i].e, gap: Math.round(gap / 1000) + 's' });
            }
            r.hesitations = hesitations;

            // Did they complete the loop?
            r.loopComplete = !!(data.firstRunTs && data.firstPlaybackTs && data.secondActionTs);
            r.returned = !!data.returnTs;

            console.table([r]);
            console.log('[GLActivation] Full events:', events);
            return r;
        } catch(e) { console.log('No activation data'); return null; }
    },
    reset: function() { localStorage.removeItem(_ACT_KEY); console.log('Activation data cleared'); }
};

function _getActionsToday() {
    try {
        var log = JSON.parse(localStorage.getItem(_ACTION_LOG_KEY) || '{}');
        return log[_todayStr()] || [];
    } catch(e) { return []; }
}

function _getActionsThisWeek() {
    try {
        var log = JSON.parse(localStorage.getItem(_ACTION_LOG_KEY) || '{}');
        var now = new Date();
        var weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
        var actions = [];
        Object.keys(log).forEach(function(date) {
            if (date >= weekAgo) actions = actions.concat(log[date]);
        });
        return actions;
    } catch(e) { return []; }
}

function _didPracticeToday() {
    return _getActionsToday().some(function(a) { return a.type === 'practice_set' || a.type === 'practice_all' || a.type === 'rehearsal'; });
}

// ── Play Bundle via Unified Engine ──────────────────────────────────────────

window.hdPlayBundle = async function(bundleType) {
    // Use unified engine if available
    if (typeof GLPlayerEngine !== 'undefined' && typeof GLPlayerUI !== 'undefined' && typeof ListeningBundles !== 'undefined') {
        try {
            var bundle = await ListeningBundles.computeBundle(bundleType);
            if (!bundle || !bundle.songs || !bundle.songs.length) {
                if (typeof showToast === 'function') showToast('No songs in this bundle');
                return;
            }
            var songs = bundle.songs.map(function(s) { return s.songTitle || s.title || s; });
            var labels = { gig: 'Gig Set', rehearsal: 'Rehearsal Set', focus: 'Focus Set', northstar: 'North Star' };
            var contextLabels = { focus: 'Practicing weakest songs (' + songs.length + ')', gig: 'Running the gig set (' + songs.length + ' songs)', rehearsal: 'Rehearsal prep (' + songs.length + ' songs)' };
            GLPlayerEngine.loadQueue(songs, { name: labels[bundleType] || 'Practice', mode: 'default', context: contextLabels[bundleType] || '' });
            GLPlayerUI.showOverlay();
            GLPlayerEngine.play(0);
            // Log action
            var actionTypes = { focus: 'practice_all', gig: 'practice_set', rehearsal: 'practice_set' };
            _logAction(actionTypes[bundleType] || 'practice_set');
            // Listen for queue completion
            GLPlayerEngine.on('queueEnd', function _hdQueueDone() {
                _logAction('completed_' + (actionTypes[bundleType] || 'set'));
                GLPlayerEngine.off('queueEnd', _hdQueueDone);
            });
            return;
        } catch(e) { console.warn('[hdPlayBundle] unified engine failed:', e); }
    }
    // Fallback to legacy
    if (typeof ListeningBundles !== 'undefined') ListeningBundles.quickLaunch(bundleType, 'spotify');
};

// ── Action Owed Card (all modes) ─────────────────────────────────────────────
// Uses FeedActionState as single source of truth. Shows personal action debt
// or completion state. Populated async after feed data loads.

// ── Band Alignment Card (Lock In mode) ──────────────────────────────────────
// Shows how close the band is to having all decisions resolved.
// Uses FeedActionState.computeBandAlignment() — populated async.

function _renderBandAlignmentCard() {
    return '<div id="hdBandAlignCard" class="app-card home-anim-cards" style="border-left:3px solid rgba(99,102,241,0.3)">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:1em">\uD83C\uDFAF</span>'
        + '<span style="font-size:0.85em;font-weight:700;color:var(--text)">Band Alignment</span>'
        + '</div>'
        + '<div id="hdBandAlignContent" style="margin-top:8px;font-size:0.82em;color:var(--text-dim)">Checking\u2026</div>'
        + '</div>';
}

function _fillBandAlignmentCard() {
    var el = document.getElementById('hdBandAlignContent');
    var card = document.getElementById('hdBandAlignCard');
    if (!el || !card) return;

    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    if (!fas) { el.innerHTML = 'Not available'; return; }

    // Use feed cache if available, otherwise lightweight poll query
    if (typeof _feedCache !== 'undefined' && _feedCache && typeof _feedMeta !== 'undefined') {
        var align = fas.computeBandAlignment(_feedCache, _feedMeta);
        _renderBandAlignContent(el, card, align);
        return;
    }

    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') { el.innerHTML = 'Offline'; return; }

    db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value').then(function(snap) {
        var polls = snap.val();
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var actionable = 0, resolved = 0;
        if (polls) {
            Object.values(polls).forEach(function(p) {
                if (!p || !p.ts) return;
                actionable++;
                var vc = p.votes ? Object.keys(p.votes).length : 0;
                if (vc >= memberCount) resolved++;
            });
        }
        var pct = actionable > 0 ? Math.round((resolved / actionable) * 100) : 100;
        var label = pct >= 100 ? 'Locked in' : pct >= 75 ? 'Almost there' : pct >= 50 ? 'Making progress' : 'Needs work';
        _renderBandAlignContent(el, card, { pct: pct, actionable: actionable, resolved: resolved, label: label });
    }).catch(function() { el.innerHTML = 'Could not load'; });
}

function _renderBandAlignContent(el, card, align) {
    var color = align.pct >= 100 ? '#86efac' : align.pct >= 75 ? '#818cf8' : align.pct >= 50 ? '#fbbf24' : '#f87171';
    card.style.borderLeftColor = align.pct >= 100 ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)';

    var html = '<div style="display:flex;align-items:center;gap:10px">'
        + '<div style="font-size:1.4em;font-weight:800;color:' + color + ';line-height:1">' + align.pct + '%</div>'
        + '<div style="flex:1">'
        + '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:4px">'
        + '<div style="height:100%;width:' + align.pct + '%;background:' + color + ';border-radius:2px;transition:width 0.4s"></div></div>'
        + '<div style="font-size:0.78em;font-weight:600;color:' + color + '">' + _escHtml(align.label) + '</div>'
        + '</div></div>';

    if (align.actionable > 0 && align.pct < 100) {
        var blocking = align.actionable - align.resolved;
        html += '<div style="font-size:0.75em;color:var(--text-dim);margin-top:4px">' + align.resolved + '/' + align.actionable + ' decisions resolved</div>';
        // Rehearsal blocker warning
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var events = fas ? fas.getNextEvents() : null;
        if (events && events.rehearsal && blocking > 0) {
            var now = new Date(); now.setHours(0,0,0,0);
            var rDate = new Date(events.rehearsal + 'T12:00:00');
            var daysTo = Math.ceil((rDate - now) / 86400000);
            if (daysTo <= 3 && daysTo >= 0) {
                html += '<div style="font-size:0.75em;font-weight:700;color:#f87171;margin-top:4px">\u26A0\uFE0F ' + blocking + ' item' + (blocking > 1 ? 's' : '') + ' still blocking rehearsal</div>';
            }
        }
    }
    el.innerHTML = html;
}

function _scheduleBandAlignFill() {
    setTimeout(_fillBandAlignmentCard, 400);
}

function _renderActionOwedCard() {
    return '<div id="hdActionOwedCard" class="app-card home-anim-cards" style="border-left:4px solid rgba(245,158,11,0.4);cursor:pointer;background:linear-gradient(135deg,var(--bg-card,#1e293b),rgba(245,158,11,0.02));box-shadow:0 2px 12px rgba(0,0,0,0.15)" onclick="showPage(\'feed\')">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:1.1em">\uD83D\uDCE1</span>'
        + '<span style="font-size:0.9em;font-weight:800;color:var(--text)">Band Feed</span>'
        + '<span style="margin-left:auto;font-size:0.75em;font-weight:600;color:#a5b4fc;padding:3px 10px;border-radius:5px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06)">Open \u2192</span>'
        + '</div>'
        + '<div id="hdActionOwedContent" style="margin-top:10px;font-size:0.82em;color:var(--text-dim)">Checking\u2026</div>'
        + '</div>';
}

// Async fill — runs after dashboard renders. Loads poll data if feed cache
// isn't available yet (the feed may not have been visited this session).
function _fillActionOwedCard() {
    var el = document.getElementById('hdActionOwedContent');
    var card = document.getElementById('hdActionOwedCard');
    if (!el || !card) return;

    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    if (!fas) { el.innerHTML = '<span style="color:var(--text-dim)">Feed not available</span>'; return; }

    // If feed cache exists, use it directly
    if (typeof _feedCache !== 'undefined' && _feedCache && typeof _feedMeta !== 'undefined') {
        var summary = fas.computeSummary(_feedCache, _feedMeta);
        _renderActionOwedContent(el, card, summary, _feedCache, _feedMeta, fas);
        return;
    }

    // Otherwise do a lightweight poll check (same as badge bg refresh)
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        el.innerHTML = '<span style="color:var(--text-dim)">Offline</span>';
        return;
    }
    var myVoteKey = fas.getMyVoteKey();
    db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value').then(function(snap) {
        var polls = snap.val();
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var myCount = 0, waitCount = 0, topItems = [];
        if (polls) {
            Object.entries(polls).forEach(function(entry) {
                var p = entry[1];
                if (!p || !p.ts) return;
                var vc = p.votes ? Object.keys(p.votes).length : 0;
                if (vc >= memberCount) return;
                var iVoted = !!(myVoteKey && p.votes && p.votes[myVoteKey] !== undefined);
                if (!iVoted) {
                    myCount++;
                    if (topItems.length < 3) topItems.push({ text: p.question || p.title || 'Poll', id: entry[0] });
                } else { waitCount++; }
            });
        }
        var summary = { needsMyInput: myCount, waitingOnBand: waitCount, allClear: myCount === 0 };
        _renderActionOwedContent(el, card, summary, null, null, fas, topItems);
    }).catch(function() {
        el.innerHTML = '<span style="color:var(--text-dim)">Could not load</span>';
    });
}

function _renderActionOwedContent(el, card, summary, feedCache, feedMeta, fas, topItems) {
    if (summary.allClear || summary.needsMyInput === 0) {
        // Completion state
        card.style.borderLeftColor = 'rgba(34,197,94,0.3)';
        var html = '<div style="display:flex;align-items:center;gap:8px">'
            + '<span style="font-size:1.1em">\u2705</span>'
            + '<div><div style="font-weight:700;color:#86efac">You\u2019re locked in.</div>'
            + '<div style="font-size:0.9em;color:var(--text-dim)">Nothing needs you right now.</div>';
        if (summary.waitingOnBand > 0) {
            html += '<div style="font-size:0.85em;color:var(--text-dim);margin-top:2px">Waiting on band: ' + summary.waitingOnBand + '</div>';
        }
        html += '</div></div>';
        el.innerHTML = html;
        return;
    }

    // Action owed state
    card.style.borderLeftColor = 'rgba(245,158,11,0.5)';
    var html = '<div style="font-weight:800;color:#fbbf24;font-size:0.9em;margin-bottom:6px">'
        + summary.needsMyInput + ' item' + (summary.needsMyInput > 1 ? 's' : '') + ' need you</div>';

    // Show top items — first one gets "Do this next:" emphasis
    var items = topItems || [];
    if (!items.length && feedCache && fas) {
        for (var i = 0; i < feedCache.length && items.length < 3; i++) {
            var meta = feedMeta ? (feedMeta[feedCache[i].type + ':' + feedCache[i].id] || {}) : {};
            var state = fas.getActionState(feedCache[i], meta);
            if (state.needsMyInput) {
                items.push({ text: feedCache[i].text || 'Item', id: feedCache[i].id });
            }
        }
    }
    if (items.length) {
        var first = items[0];
        var ft = (first.text || '').substring(0, 55);
        if ((first.text || '').length > 55) ft += '\u2026';
        html += '<div style="font-size:0.85em;color:var(--text);padding:4px 0;font-weight:600">\u25B6 Jump in: ' + _escHtml(ft) + '</div>';
        for (var ii = 1; ii < items.length; ii++) {
            var t = (items[ii].text || '').substring(0, 55);
            if ((items[ii].text || '').length > 55) t += '\u2026';
            html += '<div style="font-size:0.82em;color:var(--text-dim);padding:2px 0">\u2022 ' + _escHtml(t) + '</div>';
        }
    }

    el.innerHTML = html;
}

// Schedule fill after dashboard renders
var _hdActionFillScheduled = false;
function _scheduleActionOwedFill() {
    if (_hdActionFillScheduled) return;
    _hdActionFillScheduled = true;
    setTimeout(function() { _hdActionFillScheduled = false; _fillActionOwedCard(); }, 300);
}

function _renderModeHeader(icon, title, subtitle) {
    var dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Mode color accent
    var modeColor = { 'Sharpen': '#f97316', 'Lock In': '#6366f1', 'Play': '#10b981' }[title] || '#6366f1';

    // Mode micro-guidance
    var guidanceHtml = '';
    var modeGuide = {
        'Sharpen': 'Personal reps. Get your part down before rehearsal.',
        'Lock In': 'Band alignment. Focus on starts, endings, transitions.',
        'Play': 'No thinking. Everything should feel automatic on stage.'
    };
    var guide = modeGuide[title];
    if (guide) {
        var modeKey = 'gl_mode_help_' + title.toLowerCase().replace(/\s/g, '_');
        var views = parseInt(localStorage.getItem(modeKey) || '0', 10);
        if (views < 3) {
            localStorage.setItem(modeKey, String(views + 1));
            guidanceHtml = '<div style="font-size:0.75em;color:var(--text-dim);padding:0 4px 4px;opacity:0.7">' + _escHtml(guide) + '</div>';
        }
    }

    return '<div class="hd-cc-header home-anim-header" style="border-bottom:2px solid ' + modeColor + '">'
        + '<div class="hd-cc-header__left">'
        + '<div class="hd-cc-header__title" style="color:' + modeColor + '">' + icon + ' ' + title + '</div>'
        + '<div class="hd-cc-header__date">' + dateStr + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="color:var(--text-dim);font-size:0.85em;padding:0 4px 6px;font-style:italic">' + subtitle + '</div>'
        + guidanceHtml;
}

function _renderSharpenPracticeCard(bundle) {
    var myKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
    var html = '<div class="app-card home-anim-cards">';
    html += '<h3 style="margin:0 0 12px">\uD83C\uDFAF What to Practice</h3>';

    // Find songs where readiness is lowest (active songs only) — via GLStore.getNowFocus()
    var _focusData = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var top3 = (_focusData.list || []).slice(0, 3).map(function(s) {
        return { title: s.title, score: Math.round(s.avg), band: '' };
    });

    if (top3.length === 0) {
        html += '<div style="color:var(--text-dim);font-size:0.88em;padding:8px 0">No weak songs found \u2014 rate your readiness on a few songs to get started.</div>';
    } else {
        top3.forEach(function(s) {
            var color = (typeof readinessColor === 'function') ? readinessColor(s.score) : '#64748b';
            html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">';
            html += '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></div>';
            html += '<span style="flex:1;font-weight:500;font-size:0.9em">' + s.title + '</span>';
            html += '<span style="font-size:0.75em;color:' + color + ';font-weight:700">' + s.score + '/5</span>';
            html += '</div>';
        });
    }
    html += '<button onclick="showPage(\'practice\')" class="btn btn-primary" style="margin-top:14px;width:100%;justify-content:center">\uD83C\uDFAF Start Practice</button>';
    html += '</div>';
    return html;
}

function _renderSharpenWeakSongs(bundle) {
    return '<div id="hdWeakSongsCard" class="app-card home-anim-cards">'
        + '<h3 style="margin:0 0 8px">\uD83C\uDFAF Songs to Tighten</h3>'
        + '<div style="color:var(--text-dim);font-size:0.82em">Loading weak songs...</div>'
        + '</div>';
}

function _renderSharpenRecentPractice(bundle) {
    var stats = (typeof GLStore !== 'undefined' && GLStore.getAllSongPracticeStats)
        ? GLStore.getAllSongPracticeStats() : {};
    var recent = Object.entries(stats)
        .filter(function(e) { return e[1].lastPracticedAt; })
        .sort(function(a, b) { return (b[1].lastPracticedAt || '').localeCompare(a[1].lastPracticedAt || ''); })
        .slice(0, 5);

    var html = '<div class="app-card home-anim-cards">';
    html += '<h3 style="margin:0 0 8px">\uD83D\uDD52 Recently Practiced</h3>';
    if (recent.length === 0) {
        html += '<div style="color:var(--text-dim);font-size:0.82em;padding:4px 0">No practice sessions yet.</div>';
    } else {
        recent.forEach(function(entry) {
            var title = entry[0];
            var stat = entry[1];
            var ago = stat.lastPracticedAt ? _timeAgo(stat.lastPracticedAt) : '';
            html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">';
            html += '<span style="flex:1;font-size:0.88em;font-weight:500">' + title + '</span>';
            html += '<span style="font-size:0.72em;color:var(--text-dim)">' + ago + '</span>';
            html += '</div>';
        });
    }
    html += '</div>';
    return html;
}

function _timeAgo(isoStr) {
    if (!isoStr) return '';
    var diff = Date.now() - new Date(isoStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
}

// ── LOCK IN dashboard: session-level rehearsal plan ───────────────────────────
function _renderLockinDashboard(bundle, wf, isStoner) {
    var dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Build secondary suggestions (max 2)
    var _secondaries = _buildSecondaryActions(bundle);

    // ── Proactive intelligence ──
    var _riskCard = _renderEventRiskCard(bundle);
    var _nudge = _renderSmartNudge(bundle);

    return [
        '<div class="home-dashboard hd-command-center" style="max-width:640px;margin:0 auto">',
        '<div style="font-size:0.75em;color:var(--text-dim);padding:0 4px 6px">' + dateStr + '</div>',

        // ── Event risk alert (if any) ──
        _riskCard,

        // ── Primary recommendation (ONE action) ──
        _renderNextActionCard(bundle, wf),

        // ── Smart nudge (practice recency, readiness drop) ──
        _nudge,

        // ── Secondary suggestions (max 2, minimal) ──
        (_secondaries.length ? '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">' + _secondaries.join('') + '</div>' : ''),

        // ── Band Status (compact, merged scorecard + readiness) ──
        _renderBandStatusCompact(bundle),

        // ── Band Room (demoted — collapsed) ──
        '<div id="hdPollCard"></div>',

        // ── Post-rehearsal prompt mount ──
        '<div id="hdPostRehearsalPrompt"></div>',
        '</div>'
    ].join('');
}

function _buildSecondaryActions(bundle) {
    var items = [];
    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { count: 0 };
    var hasSongs = (typeof allSongs !== 'undefined') && allSongs.length > 0;

    // Suggest weak song practice if not already the primary
    var _focusTitle = focus.primary ? (typeof focus.primary === 'string' ? focus.primary : (focus.primary.title || null)) : null;
    var _readinessTone = function(avg, songTitle) {
        // Build "[status] → [action]" pattern
        var status = '';
        if (avg <= 0) return 'not rated yet';
        else if (avg < 2) status = 'needs work';
        else if (avg <= 3.5) status = 'getting there';
        else status = 'almost ready';
        // Get top issue for the action part
        var action = '';
        if (songTitle) {
            try {
                if (typeof GLInsights !== 'undefined' && GLInsights.buildActionPlan) {
                    var plan = GLInsights.buildActionPlan(songTitle);
                    if (plan && plan.recommendation) {
                        action = plan.recommendation.toLowerCase();
                        if (action.length > 28) action = action.slice(0, 28) + '\u2026';
                    }
                }
            } catch(e) {}
        }
        return action ? status + ' \u2192 ' + action : status + ' (' + avg.toFixed(1) + '/5)';
    };
    var _selectAndHighlight = function(title) {
        return "selectSong('" + _escHtml(title).replace(/'/g, "\\'") + "');setTimeout(function(){var p=document.querySelector('.song-detail-page');if(p){p.style.transition='box-shadow 0.3s';p.style.boxShadow='0 0 20px rgba(99,102,241,0.15)';setTimeout(function(){p.style.boxShadow='';},1500);}},600)";
    };
    // Check if hero already targets this song (avoid repeating the same instruction)
    var _heroSong = null;
    try {
        if (typeof GLInsights !== 'undefined' && GLInsights.getNextAction) {
            var _ia = GLInsights.getNextAction();
            if (_ia && _ia.song) _heroSong = _ia.song;
        }
    } catch(e) {}

    // Use second focus song if hero already covers the primary
    var _practiceSong = _focusTitle;
    if (_heroSong && _focusTitle && _heroSong.toLowerCase() === _focusTitle.toLowerCase()) {
        var _focusList2 = (focus.list || []).map(function(s) { return typeof s === 'string' ? s : (s.title || ''); });
        _practiceSong = _focusList2[1] || _focusTitle; // fall back if only one
    }

    if (focus.count > 0 && _practiceSong) {
        var avgR = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(_practiceSong) : 0;
        if (avgR < 4) {
            items.push(_secondaryCard(
                'Practice ' + _escHtml(_practiceSong),
                _readinessTone(avgR, _practiceSong),
                _selectAndHighlight(_practiceSong),
                '\uD83C\uDFB8',
                true
            ));
        }
    }

    // Guarantee: if no practice card yet but songs exist, suggest a song anyway
    if (!items.length && _practiceSong) {
        var avgR2 = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(_practiceSong) : 0;
        items.push(_secondaryCard(
            'Practice ' + _escHtml(_practiceSong),
            avgR2 >= 4 ? 'keep it sharp' : _readinessTone(avgR2, _practiceSong),
            _selectAndHighlight(_practiceSong),
            '\uD83C\uDFB8',
            true
        ));
    }

    // Suggest schedule if upcoming event
    var nextGig = bundle.gigs && bundle.gigs[0];
    var daysOut = nextGig ? _dayDiff(_todayStr(), nextGig.date) : 999;
    if (daysOut > 3 && daysOut < 30) {
        items.push(_secondaryCard(
            (nextGig.venue || 'Gig') + ' in ' + daysOut + ' days',
            'Check your schedule',
            "showPage('calendar')",
            '\uD83D\uDCC5'
        ));
    }

    return items.slice(0, 2);
}

function _secondaryCard(title, sub, onclick, icon, emphasize) {
    var border = emphasize ? 'border:1px solid rgba(99,102,241,0.15);background:rgba(99,102,241,0.03)' : 'border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)';
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;' + border + ';cursor:pointer;transition:background 0.15s" onclick="' + onclick + '" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">'
        + '<span style="font-size:1.1em;flex-shrink:0">' + icon + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:0.82em;font-weight:600;color:var(--text,#f1f5f9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + '</div>'
        + '<div style="font-size:0.68em;color:var(--text-dim,#475569)">' + sub + '</div>'
        + '</div>'
        + '<span style="font-size:0.72em;color:var(--text-dim)">\u203A</span>'
        + '</div>';
}

// ============================================================================
// BAND STATUS COMPACT — merged scorecard headline + readiness bar + counts
// ============================================================================

function _renderBandStatusCompact(bundle) {
    var sc = _computeScorecard(bundle) || { healthSummary: '', healthColor: '#475569' };
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var totalScore = 0, ratedCount = 0, lowCount = 0, lockedCount = 0;
    songs.forEach(function(s) {
        if (typeof GLStore === 'undefined' || !GLStore.isActiveSong(s.title)) return;
        var avg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(s.title) : 0;
        if (avg === 0) return; // unrated
        totalScore += avg; ratedCount++;
        if (avg < 3) lowCount++;
        if (avg >= 4) lockedCount++;
    });
    var overallAvg = ratedCount > 0 ? (totalScore / ratedCount) : 0;
    var pct = ratedCount > 0 ? Math.round(overallAvg / 5 * 100) : 0;
    var barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : (ratedCount > 0 ? '#ef4444' : '#475569');

    // Headline: use scorecard summary if rated, otherwise specific empty state
    var headline = sc.healthSummary;
    if (ratedCount === 0) headline = 'Open a song and rate your readiness';
    var scoreLabel = ratedCount > 0 ? overallAvg.toFixed(1) + '/5' : '\u2014';

    // ── Member readiness visibility ──
    var _memberReadiness = '';
    if (ratedCount > 0) {
        var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        if (members.length >= 2) {
            var _ready = [], _needsReps = [];
            members.forEach(function(m) {
                var key = m.key || m;
                var name = bm[key] ? (bm[key].name || key) : key;
                // Check how many songs this member rated ≥ 4
                var memberReady = 0, memberTotal = 0;
                songs.forEach(function(s) {
                    if (typeof GLStore === 'undefined' || !GLStore.isActiveSong(s.title)) return;
                    var scores = (typeof GLStore !== 'undefined' && GLStore.getReadiness) ? (GLStore.getReadiness(s.title) || {}) : {};
                    var score = scores[key] || 0;
                    if (score > 0) { memberTotal++; if (score >= 4) memberReady++; }
                });
                if (memberTotal > 0 && memberReady >= memberTotal * 0.7) _ready.push(name);
                else if (memberTotal > 0) _needsReps.push(name);
            });
            if (_ready.length || _needsReps.length) {
                _memberReadiness = '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);font-size:0.7em">';
                if (_ready.length) _memberReadiness += '<div style="color:var(--text-dim)">\u2713 Ready: <span style="color:#86efac">' + _ready.join(', ') + '</span></div>';
                if (_needsReps.length) _memberReadiness += '<div style="color:var(--text-dim)">Needs reps: <span style="color:var(--text-muted)">' + _needsReps.join(', ') + '</span></div>';
                _memberReadiness += '</div>';
            }
        }
    }

    // ── Shared commitment count ──
    var _commitHtml = '';
    try {
        var _commitData = JSON.parse(localStorage.getItem('gl_band_commits_today') || '{}');
        var _today = _todayStr();
        if (_commitData.date === _today && _commitData.count > 0) {
            _commitHtml = '<div style="font-size:0.68em;color:#a5b4fc;margin-top:4px">\uD83C\uDFAF ' + _commitData.count + ' member' + (_commitData.count > 1 ? 's' : '') + ' committed today</div>';
        }
    } catch(e) {}

    return '<div style="padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);margin-bottom:12px">'
        // Headline + score
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<span style="font-size:0.8em;font-weight:700;color:' + (ratedCount > 0 ? (sc.healthColor || '#94a3b8') : '#475569') + '">' + _escHtml(headline) + '</span>'
        + '<span style="font-size:0.85em;font-weight:800;color:' + barColor + '">' + scoreLabel + '</span>'
        + '</div>'
        // Readiness bar
        + (ratedCount > 0 ? '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:8px">'
        + '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px;transition:width 0.3s"></div>'
        + '</div>' : '')
        // Counts
        + '<div style="display:flex;gap:12px;font-size:0.7em;color:var(--text-dim)">'
        + (lockedCount > 0 ? '<span>\uD83D\uDD12 ' + lockedCount + ' locked</span>' : '')
        + (lowCount > 0 ? '<span style="color:#fbbf24">\u26A0\uFE0F ' + lowCount + ' need work</span>' : '')
        + '<span>' + ratedCount + ' rated</span>'
        + '</div>'
        + _memberReadiness
        + _commitHtml
        // Micro-guidance: rehearsal pressure when few weak songs
        + (function() {
            if (lowCount > 0 && lowCount <= 2) {
                try {
                    var _calEvts = (typeof GLStore !== 'undefined' && GLStore.getCalendarEvents) ? GLStore.getCalendarEvents() : [];
                    var _td = new Date().toISOString().split('T')[0];
                    var _nextReh = _calEvts.filter(function(e) { return e.type === 'rehearsal' && (e.date || '') >= _td; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
                    if (_nextReh) {
                        var _rd = Math.ceil((new Date(_nextReh.date + 'T12:00:00') - new Date(_td + 'T12:00:00')) / 86400000);
                        if (_rd <= 3) return '<div style="font-size:0.68em;color:#fbbf24;margin-top:6px">\u2192 fix before rehearsal</div>';
                    }
                } catch(e) {}
            }
            return '';
        })()
        + _buildTrendSignal()
        + '</div>';
}

// ============================================================================
// BAND SCORECARD — "Are we getting better as a band?" (used by collapsed details)
// ============================================================================

function _renderBandScorecard(bundle) {
    var sc = _computeScorecard(bundle);
    if (!sc) return '';

    var trendLabels = { improving: 'Getting Tighter', steady: 'Holding Steady', declining: 'Needs Work' };
    var trendIcons = { improving: '\u2191', steady: '\u2192', declining: '\u2193' };
    var trendColors = { improving: '#22c55e', steady: '#94a3b8', declining: '#fbbf24' };

    // Elevated card with subtle gradient border
    var html = '<div class="app-card" style="padding:16px 16px 14px;margin-bottom:14px;border:1px solid rgba(99,102,241,0.15);background:linear-gradient(165deg,rgba(99,102,241,0.05) 0%,rgba(15,23,42,0.6) 100%);border-radius:14px;position:relative;overflow:hidden">';

    // Subtle accent line at top
    html += '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,' + (sc.healthColor || '#64748b') + ',transparent)"></div>';

    // Header row
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div style="font-size:0.78em;font-weight:800;color:var(--text);letter-spacing:-0.01em">\uD83D\uDCCA Your Band Right Now</div>';
    if (sc.trend) html += '<div style="font-size:0.72em;font-weight:700;color:' + (trendColors[sc.trend] || '#94a3b8') + ';padding:3px 10px;border-radius:6px;background:' + (trendColors[sc.trend] || '#94a3b8') + '15">' + (trendIcons[sc.trend] || '') + ' ' + (trendLabels[sc.trend] || '') + '</div>';
    html += '</div>';

    // Health summary — the answer
    html += '<div style="font-size:0.92em;font-weight:700;color:' + (sc.healthColor || '#94a3b8') + ';margin-bottom:4px;line-height:1.35">' + _escHtml(sc.healthSummary) + '</div>';

    // Coach line
    if (sc.coachLine) html += '<div style="font-size:0.78em;color:#64748b;font-style:italic;margin-bottom:10px">' + _escHtml(sc.coachLine) + '</div>';

    // Top focus — single most important issue as callout
    if (sc.topFocus) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:10px;border-radius:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15)">';
        html += '<span style="font-size:0.65em;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0">Top Focus</span>';
        html += '<span style="font-size:0.78em;font-weight:600;color:#e2e8f0">' + _escHtml(sc.topFocus) + '</span>';
        html += '</div>';
    }

    // Rating dots
    if (sc.ratingDots) {
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:8px">';
        html += '<span style="font-size:0.65em;color:#475569;font-weight:600">Last ' + sc.sessionCount + '</span>';
        html += '<span style="font-size:0.9em;letter-spacing:3px">' + sc.ratingDots + '</span>';
        html += '</div>';
    }

    // Strengths + Issues (side by side)
    if (sc.strengths.length || sc.issues.length) {
        html += '<div style="display:flex;gap:14px;margin-bottom:10px">';
        if (sc.strengths.length) {
            html += '<div style="flex:1">';
            html += '<div style="font-size:0.62em;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">\u2714 What\u2019s Working</div>';
            sc.strengths.forEach(function(s) { html += '<div style="font-size:0.73em;color:#94a3b8;padding:2px 0;line-height:1.4">\u2022 ' + _escHtml(s) + '</div>'; });
            html += '</div>';
        }
        if (sc.issues.length) {
            html += '<div style="flex:1">';
            html += '<div style="font-size:0.62em;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">\u25B6 Focus Here</div>';
            sc.issues.forEach(function(s) { html += '<div style="font-size:0.73em;color:#94a3b8;padding:2px 0;line-height:1.4">\u2022 ' + _escHtml(s) + '</div>'; });
            html += '</div>';
        }
        html += '</div>';
    }

    // Song movement with timeframe
    if (sc.songsImproved > 0 || sc.songsDeclining > 0) {
        html += '<div style="display:flex;gap:12px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.04);font-size:0.7em;flex-wrap:wrap">';
        if (sc.songsImproved > 0) html += '<span style="color:#22c55e;font-weight:600">\u2191 ' + sc.songsImproved + ' song' + (sc.songsImproved > 1 ? 's' : '') + ' locked in</span>';
        if (sc.songsDeclining > 0) html += '<span style="color:#fbbf24;font-weight:600">\u2193 ' + sc.songsDeclining + ' need attention</span>';
        if (sc.songsUnchanged > 0) html += '<span style="color:#475569">\u2192 ' + sc.songsUnchanged + ' in progress</span>';
        html += '<span style="color:#334155;margin-left:auto">current snapshot</span>';
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function _computeScorecard(bundle) {
    var sessions = [];
    try {
        if (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache) sessions = _rhSessionsCache;
    } catch(e) {}

    var rc = bundle.readinessCache || {};
    var allSongsList = (typeof allSongs !== 'undefined') ? allSongs : [];

    var hasSessions = sessions.length > 0;
    var hasReadiness = Object.keys(rc).length > 0;
    if (!hasSessions && !hasReadiness) return null;

    var sc = {
        trend: null, healthSummary: '', healthColor: '#94a3b8', coachLine: '',
        ratingDots: '', sessionCount: 0,
        strengths: [], issues: [],
        songsImproved: 0, songsDeclining: 0, songsUnchanged: 0
    };

    // ── Session analysis ──
    var rated = sessions.filter(function(s) { return s.rating; }).slice(0, 5);
    var ratingValues = { great: 3, solid: 2, needs_work: 1 };
    var ratingIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };

    if (rated.length >= 2) {
        sc.sessionCount = rated.length;
        sc.ratingDots = rated.map(function(s) { return ratingIcons[s.rating] || '\u25CB'; }).reverse().join('');
        var recentHalf = rated.slice(0, Math.ceil(rated.length / 2));
        var olderHalf = rated.slice(Math.ceil(rated.length / 2));
        var recentAvg = recentHalf.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / recentHalf.length;
        var olderAvg = olderHalf.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / olderHalf.length;
        if (recentAvg > olderAvg + 0.3) sc.trend = 'improving';
        else if (recentAvg < olderAvg - 0.3) sc.trend = 'declining';
        else sc.trend = 'steady';

        // ── Strengths (human language, priority-ordered) ──
        var avgRating = rated.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / rated.length;

        // Frequency first (most actionable signal)
        var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        var weekSessions = sessions.filter(function(s) { return (s.date || '') >= weekAgo; });
        if (weekSessions.length >= 3) sc.strengths.push('Rehearsing regularly \u2014 great rhythm');
        else if (weekSessions.length >= 2) sc.strengths.push('Staying active with rehearsals');

        // Quality second
        if (avgRating >= 2.5) sc.strengths.push('Quality is consistently high');

        // Time management third
        var onTimeCount = sessions.slice(0, 5).filter(function(s) { return s.totalBudgetMin && Math.abs((s.totalActualMin || 0) - s.totalBudgetMin) <= 3; }).length;
        if (onTimeCount >= 3) sc.strengths.push('Staying on pace during rehearsals');

        // ── Issues (clear but encouraging, priority-ordered) ──
        // Frequency gap first
        if (weekSessions.length === 0 && sessions.length > 0) sc.issues.push('Haven\u2019t rehearsed this week \u2014 schedule one');

        // Timing issues second
        var overCount = sessions.slice(0, 5).filter(function(s) { return s.totalBudgetMin && (s.totalActualMin || 0) - s.totalBudgetMin > 10; }).length;
        if (overCount >= 2) sc.issues.push('Rehearsals running long \u2014 tighten transitions');

        // Rating dip third
        if (sc.trend === 'declining') sc.issues.push('Recent sessions dipping \u2014 refocus next rehearsal');
    }

    // ── Readiness analysis ──
    var totalActive = 0, highReady = 0, lowReady = 0, midReady = 0;
    allSongsList.forEach(function(s) {
        if (typeof GLStore === 'undefined' || !GLStore.isActiveSong(s.title)) return;
        totalActive++;
        var avg = GLStore.avgReadiness(s.title);
        if (avg >= 4) highReady++;
        else if (avg <= 2 && avg > 0) lowReady++;
        else if (avg > 0) midReady++;
    });

    if (totalActive > 0) {
        var readyPct = Math.round(highReady / totalActive * 100);
        if (readyPct >= 80) sc.strengths.push(readyPct + '% of the setbook is gig-ready');
        if (lowReady > 3) sc.issues.push(lowReady + ' songs need more reps');

        sc.songsImproved = highReady;
        sc.songsDeclining = lowReady;
        sc.songsUnchanged = midReady;
    }

    // Cap at 3 each, most important first
    sc.strengths = sc.strengths.slice(0, 3);
    sc.issues = sc.issues.slice(0, 3);

    // Top focus: single highest-priority issue as headline
    sc.topFocus = sc.issues.length ? sc.issues[0] : '';

    // ── Health summary + coach line ──
    if (sc.trend === 'improving' && highReady > lowReady) {
        sc.healthSummary = 'The band is getting tighter';
        sc.coachLine = 'You\u2019re close \u2014 a couple more strong rehearsals and you\u2019re there.';
        sc.healthColor = '#22c55e';
    } else if (sc.trend === 'improving') {
        sc.healthSummary = 'Momentum is building';
        sc.coachLine = 'The work is paying off. Keep showing up.';
        sc.healthColor = '#22c55e';
    } else if (sc.trend === 'steady' && highReady > totalActive * 0.6) {
        sc.healthSummary = 'Band is in a good place';
        sc.coachLine = 'Solid foundation \u2014 push for the next level.';
        sc.healthColor = '#a5b4fc';
    } else if (sc.trend === 'steady') {
        sc.healthSummary = 'Holding steady \u2014 room to grow';
        sc.coachLine = 'Consistency is good. Challenge yourselves this week.';
        sc.healthColor = '#94a3b8';
    } else if (sc.trend === 'declining') {
        sc.healthSummary = 'Recent sessions are slipping';
        sc.coachLine = 'Not a crisis \u2014 just needs one focused rehearsal to turn it around.';
        sc.healthColor = '#fbbf24';
    } else if (totalActive > 0 && highReady > totalActive * 0.5) {
        sc.healthSummary = highReady + ' song' + (highReady > 1 ? 's' : '') + ' locked' + (lowReady > 0 ? ' \u00B7 ' + lowReady + ' need' + (lowReady > 1 ? '' : 's') + ' attention' : '');
        sc.coachLine = 'Start tracking rehearsals to see the full picture.';
        sc.healthColor = '#94a3b8';
    } else {
        var _anyRated = (highReady + lowReady + midReady) > 0;
        sc.healthSummary = _anyRated ? 'No songs dialed in yet' : 'Open a song and rate your readiness';
        sc.coachLine = _anyRated ? 'Keep running songs to build readiness.' : 'Slide the readiness bar on any song page to get started.';
        sc.healthColor = '#64748b';
    }

    return sc;
}

function _capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function _hdEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── What To Do Next (from GLInsights action engine) ───────────────────────────
function _renderWhatToDoNext() {
  if (typeof GLInsights === 'undefined' || !GLInsights.getNextAction) return '';
  var action = GLInsights.getNextAction();
  if (!action) return '';

  var html = '<div style="margin-bottom:12px;padding:14px 16px;background:rgba(165,180,252,0.08);border:1px solid rgba(165,180,252,0.2);border-radius:12px">';
  html += '<div style="font-size:0.72em;font-weight:800;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">What To Do Next</div>';
  html += '<div style="font-size:0.92em;font-weight:700;color:var(--text);margin-bottom:4px">' + _hdEsc(action.headline) + '</div>';
  html += '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:8px">' + _hdEsc(action.detail) + '</div>';

  // Show action plan steps if available
  if (action.plan && action.plan.actionPlan && action.plan.actionPlan.length > 1) {
    html += '<div id="hdActionPlanExpand" style="display:none;margin-bottom:8px">';
    action.plan.actionPlan.forEach(function(step, i) {
      html += '<div style="font-size:0.78em;color:var(--text-dim);padding:2px 0;padding-left:12px">' + (i + 1) + '. ' + _hdEsc(step) + '</div>';
    });
    if (action.plan.estimatedTime) {
      html += '<div style="font-size:0.68em;color:var(--text-dim);padding-top:4px;font-style:italic">\u23F1 ~' + action.plan.estimatedTime + ' min</div>';
    }
    html += '</div>';
    html += '<button onclick="var el=document.getElementById(\'hdActionPlanExpand\');if(el){el.style.display=el.style.display===\'none\'?\'\':\'none\';this.textContent=el.style.display===\'none\'?\'Show plan \u25BC\':\'Hide plan \u25B2\'}" style="font-size:0.72em;color:#a5b4fc;background:none;border:none;cursor:pointer;padding:0;margin-bottom:8px">Show plan \u25BC</button>';
  }

  // CTA button
  if (action.cta === 'Start Practice' && action.song) {
    html += '<button onclick="if(typeof selectSong===\'function\')selectSong(\'' + _hdEsc(action.song).replace(/'/g, "\\'") + '\')" style="padding:8px 16px;border-radius:8px;border:none;background:#a5b4fc;color:#0f172a;font-weight:700;font-size:0.82em;cursor:pointer">\u25B6 Practice Now</button>';
  } else {
    html += '<button onclick="showPage(\'rehearsal\')" style="padding:8px 16px;border-radius:8px;border:none;background:#a5b4fc;color:#0f172a;font-weight:700;font-size:0.82em;cursor:pointer">\uD83C\uDFB8 Build Rehearsal Plan</button>';
  }

  html += '</div>';
  return html;
}

// ── Last Rehearsal Issues (from analysis pipeline) ────────────────────────────
function _renderLastRehearsalIssues() {
  if (typeof RehearsalAnalysis === 'undefined' || !RehearsalAnalysis.getIssueIndex) return '';
  var index = RehearsalAnalysis.getIssueIndex();
  var songs = Object.keys(index);
  if (!songs.length) return '';

  // Sort by issue count descending, take top 3
  songs.sort(function(a, b) { return (index[b].count || 0) - (index[a].count || 0); });
  var top = songs.slice(0, 3);

  var html = '<div style="margin-bottom:12px;padding:12px 14px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);border-radius:12px">';
  html += '<div style="font-size:0.72em;font-weight:800;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Last Rehearsal Issues</div>';

  top.forEach(function(song) {
    var entry = index[song];
    var typeLabels = (entry.types || []).map(function(t) {
      return { timing: 'timing', pitch: 'pitch', transition: 'transition', lyrics: 'lyrics', stability: 'fell apart' }[t] || t;
    });
    html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:0.82em">';
    html += '<span style="color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _hdEsc(song) + '</span>';
    html += '<span style="color:#f87171;flex-shrink:0;font-size:0.78em">' + entry.count + ' issue' + (entry.count > 1 ? 's' : '');
    if (typeLabels.length) html += ' \u00B7 ' + typeLabels.join(', ');
    html += '</span></div>';
  });

  if (songs.length > 3) {
    html += '<div style="font-size:0.72em;color:var(--text-dim);padding-top:4px">+ ' + (songs.length - 3) + ' more</div>';
  }

  html += '</div>';
  return html;
}

// ── Session-level rehearsal plan from PracticeAttention engine ───────────────
function _renderSessionPlan(bundle) {
    // Single focus section — same source as rehearsal page header and Get Better
    var _spFocus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [], reason: '' };
    var focusList = _spFocus.list;

    if (!focusList.length) return '';

    var html = '<div class="app-card home-anim-cards" style="border-color:rgba(245,158,11,0.15);background:linear-gradient(135deg,rgba(245,158,11,0.03),rgba(239,68,68,0.02))">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<h3 style="margin:0;color:#fbbf24;font-size:1em">\uD83C\uDFAF Focus for your next rehearsal</h3>';
    html += '<button onclick="window._glFocusMode=true;showPage(\'songs\')" style="font-size:0.72em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:none;background:rgba(245,158,11,0.12);color:#fbbf24">\u25B6 Practice These</button>';
    html += '</div>';

    focusList.slice(0, 5).forEach(function(song, i) {
        var color = song.avg < 2 ? '#ef4444' : song.avg < 3 ? '#fbbf24' : '#94a3b8';
        var safeSong = song.title.replace(/'/g, "\\'");
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer' + (i < focusList.length - 1 ? ';border-bottom:1px solid rgba(255,255,255,0.04)' : '') + '" onclick="showPage(\'songs\');setTimeout(function(){if(typeof selectSong===\'function\')selectSong(\'' + safeSong + '\');},300)">';
        html += '<span style="width:6px;height:6px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>';
        html += '<span style="font-size:0.85em;font-weight:600;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escHtml(song.title) + '</span>';
        html += (song.inSetlist ? '<span style="font-size:0.6em;color:#818cf8;flex-shrink:0">setlist</span>' : '');
        html += '</div>';
    });

    html += '</div>';
    return html;
}

// ── Compact band readiness snapshot ──────────────────────────────────────────
function _renderBandReadinessSnapshot(bundle) {
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var totalScore = 0, ratedCount = 0, lowCount = 0, lockedCount = 0;
    songs.forEach(function(s) {
        if (typeof GLStore === 'undefined' || !GLStore.isActiveSong(s.title)) return;
        var scores = rc[s.title] || {};
        var vals = members.map(function(m) { return scores[m.key] || 0; }).filter(function(v) { return v > 0; });
        if (vals.length === 0) return;
        var avg = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
        totalScore += avg;
        ratedCount++;
        if (avg < 3) lowCount++;
        if (avg >= 4) lockedCount++;
    });
    var overallAvg = ratedCount > 0 ? (totalScore / ratedCount) : 0;
    var pct = ratedCount > 0 ? Math.round(overallAvg / 5 * 100) : 0;
    var barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

    var html = '<div class="app-card home-anim-cards" style="padding:14px 16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<span style="font-size:0.82em;font-weight:700;color:var(--text-muted)">\uD83D\uDFE2 Band Readiness</span>';
    html += '<span style="font-size:1em;font-weight:800;color:' + barColor + '">' + overallAvg.toFixed(1) + '/5</span>';
    html += '</div>';
    html += '<div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:10px">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s"></div>';
    html += '</div>';
    html += '<div style="display:flex;gap:14px;font-size:0.75em;color:var(--text-dim)">';
    html += '<span>\uD83D\uDD12 ' + lockedCount + ' locked</span>';
    html += '<span>\u26A0\uFE0F ' + lowCount + ' need work</span>';
    html += '<span>\uD83C\uDFB5 ' + ratedCount + ' rated</span>';
    html += '</div></div>';
    return html;
}

// ── Proactive Intelligence: At Risk Detection ────────────────────────────────
function _renderEventRiskCard(bundle) {
    var calEvents = [];
    try {
        calEvents = (typeof GLStore !== 'undefined' && GLStore.getCalendarEvents) ? GLStore.getCalendarEvents() : [];
        if (!calEvents.length && bundle._calEvents) calEvents = bundle._calEvents;
    } catch(e) {}
    var today = _todayStr();
    var upcoming = calEvents.filter(function(e) { return (e.date || '') >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); });
    var nextEvent = upcoming[0];
    if (!nextEvent) return '';

    var daysOut = _dayDiff(today, nextEvent.date);
    if (daysOut > 7) return ''; // only show risk for events within a week

    var risks = [];
    var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;

    // Check RSVP completion (read from Firebase if available)
    try {
        var _db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (_db && typeof bandPath === 'function') {
            var _dk = (nextEvent.date || '').replace(/-/g, '');
            // Non-blocking: just check if we have cached avail data
            // (Full async would delay render — acceptable to miss on first load)
        }
    } catch(e) {}
    // If event is imminent and it's a rehearsal/gig, flag missing RSVPs as generic risk
    if (daysOut <= 3) {
        risks.push('Confirm attendance for all members');
    }

    // Check song readiness (if setlist linked)
    var lowReadiness = 0;
    if (typeof GLStore !== 'undefined' && GLStore.avgReadiness) {
        var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
        songs.forEach(function(s) {
            if (!GLStore.isActiveSong(s.title)) return;
            var avg = GLStore.avgReadiness(s.title);
            if (avg > 0 && avg < 3) lowReadiness++;
        });
    }
    if (lowReadiness > 0) risks.push(lowReadiness + ' song' + (lowReadiness > 1 ? 's' : '') + ' below ready');

    // Check practice recency
    var lastSession = null;
    try {
        var sessions = (typeof _rhSessionsCache !== 'undefined') ? _rhSessionsCache : [];
        if (sessions.length) lastSession = sessions[0];
    } catch(e) {}
    if (!lastSession || _dayDiff(lastSession.date || lastSession.startedAt || '', today) > 14) {
        risks.push('No rehearsal in 2+ weeks');
    }

    var eventLabel = (nextEvent.type === 'gig' ? '\uD83C\uDFA4 Gig' : '\uD83C\uDFB8 Rehearsal');
    var dateLabel = daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : 'in ' + daysOut + ' days';
    var severity = (daysOut <= 2 && risks.length >= 2) ? 'high' : (risks.length > 0 ? 'medium' : 'ok');
    var borderColor = severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f59e0b' : '#22c55e';
    var bgColor = severity === 'high' ? 'rgba(239,68,68,0.06)' : severity === 'medium' ? 'rgba(245,158,11,0.04)' : 'rgba(34,197,94,0.04)';

    // Pre-rehearsal checklist for events < 24h
    if (daysOut <= 1) {
        var html = '<div style="padding:12px 14px;margin-bottom:12px;border-radius:10px;border-left:3px solid ' + borderColor + ';background:' + bgColor + '">';
        html += '<div style="font-size:0.78em;font-weight:800;color:' + borderColor + ';margin-bottom:6px">' + eventLabel + ' ' + dateLabel + '</div>';
        html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Before you go</div>';
        // Checklist items
        var checkItems = [];
        checkItems.push({ done: rsvpCount >= memberCount, text: 'Attendance confirmed' + (rsvpCount < memberCount ? ' (' + rsvpCount + '/' + memberCount + ')' : '') });
        checkItems.push({ done: lowReadiness === 0, text: lowReadiness > 0 ? lowReadiness + ' song' + (lowReadiness > 1 ? 's' : '') + ' need work' : 'All songs ready' });
        var hasRecentPractice = false;
        try { var _lp = localStorage.getItem('gl_last_practice_ts'); hasRecentPractice = _lp && _dayDiff(_lp.substring(0, 10), today) <= 3; } catch(e) {}
        checkItems.push({ done: hasRecentPractice, text: hasRecentPractice ? 'Practiced recently' : 'No recent practice' });

        checkItems.forEach(function(ci) {
            var icon = ci.done ? '\u2705' : '\u26AA';
            var color = ci.done ? 'var(--text-dim)' : 'var(--text-muted)';
            html += '<div style="font-size:0.75em;color:' + color + ';padding:2px 0;display:flex;align-items:center;gap:6px">' + icon + ' ' + _escHtml(ci.text) + '</div>';
        });

        if (lowReadiness > 0) {
            html += '<button onclick="showPage(\'rehearsal\')" style="margin-top:8px;font-size:0.72em;font-weight:700;padding:5px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24">Quick practice \u2192</button>';
        }
        html += '</div>';
        return html;
    }

    // Standard risk card for events > 24h
    if (risks.length === 0) return '';

    var html = '<div style="padding:10px 14px;margin-bottom:12px;border-radius:10px;border-left:3px solid ' + borderColor + ';background:' + bgColor + '">';
    html += '<div style="font-size:0.78em;font-weight:800;color:' + borderColor + ';margin-bottom:4px">\u26A0\uFE0F ' + eventLabel + ' ' + dateLabel + ' is at risk</div>';
    risks.forEach(function(r) {
        html += '<div style="font-size:0.72em;color:var(--text-muted);padding:1px 0">\u2022 ' + _escHtml(r) + '</div>';
    });
    html += '</div>';
    return html;
}

// ── Proactive Intelligence: Smart Nudges ─────────────────────────────────────
function _renderSmartNudge(bundle) {
    var nudges = [];

    // Practice recency nudge
    var lastPractice = null;
    try {
        var lp = localStorage.getItem('gl_last_practice_ts');
        if (lp) lastPractice = new Date(lp);
    } catch(e) {}
    if (!lastPractice) {
        try {
            var sessions = (typeof _rhSessionsCache !== 'undefined') ? _rhSessionsCache : [];
            if (sessions.length) lastPractice = new Date(sessions[0].date || sessions[0].startedAt || '');
        } catch(e) {}
    }
    if (lastPractice) {
        var daysSince = Math.floor((Date.now() - lastPractice.getTime()) / 86400000);
        if (daysSince >= 5) nudges.push({ icon: '\uD83C\uDFB8', text: 'You haven\u2019t practiced in ' + daysSince + ' days', cta: 'Practice now', onclick: "showPage('rehearsal')" });
    }

    // Readiness drop nudge — check if any active song dropped below 3
    if (typeof GLStore !== 'undefined' && GLStore.avgReadiness) {
        var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
        var dropped = [];
        songs.forEach(function(s) {
            if (!GLStore.isActiveSong(s.title)) return;
            var avg = GLStore.avgReadiness(s.title);
            if (avg > 0 && avg < 2.5) dropped.push(s.title);
        });
        if (dropped.length === 1) {
            nudges.push({ icon: '\uD83D\uDCC9', text: dropped[0] + ' has dropped in readiness', cta: 'Work on it', onclick: "selectSong('" + _escHtml(dropped[0]).replace(/'/g, "\\'") + "')" });
        } else if (dropped.length > 1) {
            nudges.push({ icon: '\uD83D\uDCC9', text: dropped.length + ' songs have dropped in readiness', cta: 'Focus on weak songs', onclick: "showPage('songs')" });
        }
    }

    if (!nudges.length) return '';

    // Show only the most important nudge (first one)
    var n = nudges[0];
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">'
        + '<span style="font-size:0.9em">' + n.icon + '</span>'
        + '<span style="font-size:0.78em;color:var(--text-muted);flex:1">' + _escHtml(n.text) + '</span>'
        + '<button onclick="' + n.onclick + '" style="font-size:0.72em;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;white-space:nowrap">' + n.cta + '</button>'
        + '</div>';
}

// ── Post-Rehearsal Prompt ────────────────────────────────────────────────────
// Listens for session completion and shows quick feedback prompt
(function() {
    if (typeof GLStore === 'undefined' || !GLStore.on) return;
    GLStore.on('agendaSessionCompleted', function(data) {
        var el = document.getElementById('hdPostRehearsalPrompt');
        if (!el) return;
        var session = data || {};
        var delta = session.readinessDelta || null;
        var deltaText = delta && delta.deltaAvg ? (delta.deltaAvg > 0 ? '+' + delta.deltaAvg.toFixed(1) : delta.deltaAvg.toFixed(1)) : '';
        var deltaColor = delta && delta.deltaAvg > 0 ? '#22c55e' : delta && delta.deltaAvg < 0 ? '#ef4444' : 'var(--text-dim)';

        // Song-level details
        var songDetails = '';
        if (delta && delta.bySong) {
            var improved = [], declined = [], unchanged = [];
            Object.keys(delta.bySong).forEach(function(s) {
                var d = delta.bySong[s];
                if (d.delta > 0) improved.push(s);
                else if (d.delta < 0) declined.push(s);
                else unchanged.push(s);
            });
            if (improved.length || declined.length) {
                songDetails = '<div style="margin:8px 0;font-size:0.72em;text-align:left;max-width:280px;margin-left:auto;margin-right:auto">';
                if (improved.length) songDetails += '<div style="color:#22c55e;margin-bottom:2px">\u2191 ' + improved.join(', ') + '</div>';
                if (declined.length) songDetails += '<div style="color:#f59e0b">\u2193 ' + declined.join(', ') + '</div>';
                songDetails += '</div>';
            }
        }

        el.innerHTML = '<div style="padding:14px;margin-top:12px;border-radius:10px;border:1px solid rgba(34,197,94,0.15);background:rgba(34,197,94,0.04);text-align:center">'
            + '<div style="font-size:0.85em;font-weight:700;color:#86efac;margin-bottom:4px">Did that feel tighter?</div>'
            + (deltaText ? '<div style="font-size:0.82em;font-weight:800;color:' + deltaColor + ';margin-bottom:4px">Readiness ' + deltaText + '</div>' : '')
            + songDetails
            + '<div style="display:flex;gap:8px;justify-content:center">'
            + '<button onclick="_hdPostRehearsalFeedback(\'yes\')" style="font-size:0.78em;font-weight:700;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac">\uD83D\uDC4D Yes</button>'
            + '<button onclick="_hdPostRehearsalFeedback(\'same\')" style="font-size:0.78em;font-weight:700;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim)">Same</button>'
            + '<button onclick="_hdPostRehearsalFeedback(\'no\')" style="font-size:0.78em;font-weight:700;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.04);color:#fca5a5">Not yet</button>'
            + '</div></div>';

        // Auto-dismiss after 30s
        setTimeout(function() {
            if (el.innerHTML) { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function() { el.innerHTML = ''; el.style.opacity = '1'; }, 300); }
        }, 30000);
    });
})();

window._hdPostRehearsalFeedback = function(answer) {
    var el = document.getElementById('hdPostRehearsalPrompt');
    if (!el) return;

    // Save to localStorage
    try {
        var history = JSON.parse(localStorage.getItem('gl_rehearsal_feedback') || '[]');
        history.push({ answer: answer, ts: new Date().toISOString() });
        if (history.length > 20) history = history.slice(-20);
        localStorage.setItem('gl_rehearsal_feedback', JSON.stringify(history));
    } catch(e) {}

    // Save to Firebase for band-wide aggregate
    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    var myKey = fas ? fas.getMyMemberKey() : null;
    var today = _todayStr().replace(/-/g, '');
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function' && myKey) {
            db.ref(bandPath('rehearsal_feedback/' + today + '/' + myKey)).set({
                answer: answer, ts: new Date().toISOString()
            }).catch(function() {});

            // Load aggregate and show team summary
            db.ref(bandPath('rehearsal_feedback/' + today)).once('value').then(function(snap) {
                var all = snap.val() || {};
                var yes = 0, same = 0, no = 0;
                Object.values(all).forEach(function(f) {
                    if (f.answer === 'yes') yes++;
                    else if (f.answer === 'same') same++;
                    else if (f.answer === 'no') no++;
                });
                var total = yes + same + no;
                if (total >= 2) {
                    var summary = [];
                    if (yes) summary.push(yes + ' tighter');
                    if (same) summary.push(same + ' same');
                    if (no) summary.push(no + ' not yet');
                    el.innerHTML = '<div style="padding:10px;text-align:center;font-size:0.78em;color:var(--text-muted)">'
                        + '<div style="font-weight:700;margin-bottom:2px">Band check</div>'
                        + summary.join(' \u00B7 ')
                        + '</div>';
                    setTimeout(function() { el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; setTimeout(function() { el.innerHTML = ''; el.style.opacity = '1'; }, 300); }, 5000);
                    return;
                }
            }).catch(function() {});
        }
    } catch(e) {}

    var msg = answer === 'yes' ? '\uD83D\uDD25 That\u2019s progress.' : answer === 'no' ? '\uD83D\uDCAA Next time.' : '\u2713 Noted.';
    el.innerHTML = '<div style="padding:10px;text-align:center;font-size:0.78em;color:var(--text-dim)">' + msg + '</div>';
    setTimeout(function() { el.innerHTML = ''; }, 3000);
};

// ── Commitment Action ─────────────────────────────────────────────────────────
window._hdCommitToPlan = function() {
    var today = _todayStr();
    try { localStorage.setItem('gl_committed_today', today); } catch(e) {}
    if (typeof showToast === 'function') showToast('\uD83C\uDFAF Plan locked for today');

    // Post commitment to band feed (lightweight, no spam — one per day)
    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    var name = fas ? fas.getMyDisplayName() : 'A band member';
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
            // Store band-wide commit count for today
            db.ref(bandPath('daily_commits/' + today.replace(/-/g, ''))).transaction(function(current) {
                current = current || { count: 0, members: {} };
                var myKey = fas ? fas.getMyMemberKey() : 'unknown';
                if (!current.members[myKey]) {
                    current.count = (current.count || 0) + 1;
                    current.members[myKey] = new Date().toISOString();
                }
                return current;
            }).then(function(result) {
                if (result.committed && result.snapshot) {
                    var data = result.snapshot.val() || {};
                    try { localStorage.setItem('gl_band_commits_today', JSON.stringify({ date: today, count: data.count || 1 })); } catch(e) {}
                }
            }).catch(function() {});
        }
    } catch(e) {}

    if (typeof renderHomeDashboard === 'function') renderHomeDashboard();
};

// ── Practice Streak ──────────────────────────────────────────────────────────
function _buildPracticeStreak() {
    try {
        var history = JSON.parse(localStorage.getItem('gl_practice_streak') || '[]');
        // Also check gl_last_practice_ts to potentially extend streak
        var lastTs = localStorage.getItem('gl_last_practice_ts');
        if (lastTs) {
            var lastDate = lastTs.substring(0, 10);
            if (history.indexOf(lastDate) === -1) {
                history.push(lastDate);
                history.sort();
                if (history.length > 30) history = history.slice(-30);
                localStorage.setItem('gl_practice_streak', JSON.stringify(history));
            }
        }

        if (history.length < 2) return '';

        // Count consecutive days ending at today or yesterday
        var today = _todayStr();
        var yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
        var lastDay = history[history.length - 1];
        if (lastDay !== today && lastDay !== yesterday) return ''; // streak broken

        var streak = 1;
        for (var i = history.length - 2; i >= 0; i--) {
            var expected = new Date(new Date(history[i + 1] + 'T12:00:00').getTime() - 86400000).toISOString().substring(0, 10);
            if (history[i] === expected) streak++;
            else break;
        }

        if (streak < 2) return '';
        return '<div style="font-size:0.72em;color:#f59e0b;margin-top:8px;font-weight:600">\uD83D\uDD25 ' + streak + '-day streak</div>';
    } catch(e) { return ''; }
}

// ── Trend Signal ─────────────────────────────────────────────────────────────
function _buildTrendSignal() {
    var signals = [];

    // Readiness trend from scorecard
    try {
        var sessions = (typeof _rhSessionsCache !== 'undefined') ? _rhSessionsCache : [];
        if (sessions.length >= 2) {
            var rated = sessions.filter(function(s) { return s.rating; }).slice(0, 5);
            var ratingValues = { great: 3, solid: 2, needs_work: 1 };
            if (rated.length >= 2) {
                var recentHalf = rated.slice(0, Math.ceil(rated.length / 2));
                var olderHalf = rated.slice(Math.ceil(rated.length / 2));
                var recentAvg = recentHalf.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / recentHalf.length;
                var olderAvg = olderHalf.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / olderHalf.length;
                if (recentAvg > olderAvg + 0.3) signals.push({ dir: 'up', text: 'Rehearsals trending up' });
                else if (recentAvg < olderAvg - 0.3) signals.push({ dir: 'down', text: 'Rehearsals trending down' });
            }
        }
    } catch(e) {}

    // Practice frequency trend
    try {
        var history = JSON.parse(localStorage.getItem('gl_practice_streak') || '[]');
        if (history.length >= 3) {
            var recent14 = history.filter(function(d) { return d >= new Date(Date.now() - 14 * 86400000).toISOString().substring(0, 10); }).length;
            var prev14 = history.filter(function(d) { var t = new Date(Date.now() - 14 * 86400000).toISOString().substring(0, 10); var p = new Date(Date.now() - 28 * 86400000).toISOString().substring(0, 10); return d >= p && d < t; }).length;
            if (recent14 > prev14 + 1) signals.push({ dir: 'up', text: 'Practicing more often' });
            else if (recent14 < prev14 - 1) signals.push({ dir: 'down', text: 'Practice frequency dropping' });
        }
    } catch(e) {}

    if (!signals.length) return '';
    var s = signals[0];
    var color = s.dir === 'up' ? '#22c55e' : '#f59e0b';
    var arrow = s.dir === 'up' ? '\u2191' : '\u2193';
    return '<div style="font-size:0.72em;color:' + color + ';font-weight:600;margin-top:4px">' + arrow + ' ' + s.text + '</div>';
}

// ── PLAY dashboard: gig focus ────────────────────────────────────────────────
function _renderPlayDashboard(bundle, wf, isStoner) {
    return [
        '<div class="home-dashboard hd-command-center">',
        _renderModeHeader('\uD83C\uDFA4', 'Play', 'Everything you need. Nothing you don\'t.'),
        _renderNextActionCard(bundle, wf),
        _renderBandScorecard(bundle),
        _renderListeningCard('gig', '\uD83C\uDFA7 Play Your Set', 'Listen through the gig setlist'),
        _renderPlayUpcomingSet(bundle),
        _renderPlayReadiness(bundle),
        _renderActionOwedCard(),
        '</div>'
    ].join('');
}

function _renderPlayUpcomingSet(bundle) {
    var gig = bundle.gigs && bundle.gigs[0];
    var html = '<div class="app-card home-anim-cards">';

    if (gig) {
        var gigDate = gig.date ? new Date(gig.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        html += '<h3 style="margin:0 0 4px">\uD83C\uDFA4 Next Gig</h3>';
        html += '<div style="font-size:0.88em;font-weight:600;color:var(--text)">' + (gig.venue || gig.name || 'Unnamed') + '</div>';
        html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px">' + gigDate + '</div>';

        // Show setlist if linked
        if (gig.setlistId || gig.setlistIndex !== undefined) {
            html += '<button onclick="showPage(\'setlists\')" class="btn btn-primary" style="width:100%;justify-content:center">\uD83D\uDCCB View Setlist</button>';
        } else {
            html += '<div style="color:var(--text-dim);font-size:0.82em">No setlist linked yet.</div>';
            html += '<button onclick="showPage(\'setlists\')" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:8px">\uD83D\uDCCB Create Setlist</button>';
        }
    } else {
        html += '<h3 style="margin:0 0 8px">\uD83C\uDFA4 No Upcoming Gigs</h3>';
        html += '<div style="color:var(--text-dim);font-size:0.85em;margin-bottom:12px">Book a gig to see your set here.</div>';
        html += '<button onclick="showPage(\'gigs\')" class="btn btn-ghost" style="width:100%;justify-content:center">+ Add Gig</button>';
    }
    html += '</div>';
    return html;
}

function _renderPlayReadiness(bundle) {
    var html = '<div class="app-card home-anim-cards">';
    html += '<h3 style="margin:0 0 8px">\uD83D\uDFE2 Band Readiness</h3>';

    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];

    var totalScore = 0, totalCount = 0;
    songs.forEach(function(s) {
        var scores = rc[s.title] || {};
        var vals = members.map(function(m) { return scores[m.key] || 0; }).filter(function(v) { return v > 0; });
        if (vals.length > 0) {
            totalScore += vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
            totalCount++;
        }
    });
    var avg = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
    var pct = totalCount > 0 ? Math.round(totalScore / totalCount / 5 * 100) : 0;
    var barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<span style="font-size:0.85em;color:var(--text-muted)">Average</span>';
    html += '<span style="font-size:1.1em;font-weight:800;color:' + barColor + '">' + avg + '/5</span>';
    html += '</div>';
    html += '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s"></div>';
    html += '</div>';
    html += '<div style="font-size:0.75em;color:var(--text-dim);margin-top:8px">' + totalCount + ' songs rated</div>';

    html += '</div>';
    return html;
}

// ── Command Center: Header ────────────────────────────────────────────────────

function _renderCommandCenterHeader(bundle) {
    var tone = deriveHdConfidenceTone(bundle);
    var dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    var chip = '';
    if (tone) {
        chip = '<span class="hd-cc-chip" style="background:' + tone.color + '18;color:' + tone.color + ';border-color:' + tone.color + '44">' + tone.short + '</span>';
    }
    var _helpIcon = (typeof glInlineHelp !== 'undefined') ? glInlineHelp.renderHelpTrigger('command-center') : '';
    // Orientation banner — shows once per device, dismissed to localStorage
    var _orientKey = 'gl_cc_orient_dismissed';
    var _orientDismissed = false;
    try { _orientDismissed = localStorage.getItem(_orientKey) === '1'; } catch(e) {}
    var _orientBanner = _orientDismissed ? '' :
        '<div class="hd-cc-orient">'
        + '<div class="hd-cc-orient__text">'
        + 'GrooveLinx helps your band: '
        + '<strong>know what to practice next</strong> \xb7 '
        + '<strong>see if you\'re improving</strong> \xb7 '
        + '<strong>know if you\'re ready for the gig</strong>'
        + '</div>'
        + '<button class="hd-cc-orient__dismiss" onclick="try{localStorage.setItem(\'' + _orientKey + '\',\'1\')}catch(e){}this.parentElement.remove()" title="Dismiss">Got it</button>'
        + '</div>';
    return '<div class="hd-cc-header home-anim-header">'
        + '<div class="hd-cc-header__left">'
        + '<div class="hd-cc-header__title">Command Center ' + _helpIcon + '</div>'
        + '<div class="hd-cc-header__date">' + dateStr + '</div>'
        + '</div>'
        + '</div>'
        + _orientBanner;
}

// ── Command Center: Progressive Onboarding ──────────────────────────────────
// Persistent setup card for bands that haven't completed activation.
// 3 steps: Add Songs, Invite Bandmates, Schedule Rehearsal.
// Derived from real data via GLStore.evaluateOnboardingState().
// Shows celebratory success state at 3/3, dismissible.

function _renderSetupGuidance(bundle, wf) {
    var ob = (typeof GLStore !== 'undefined' && GLStore.getOnboardingState) ? GLStore.getOnboardingState() : null;
    if (!ob) return '';
    if (ob.isDismissed && !ob.isComplete) return '';

    // Already activated and dismissed — don't show
    if (ob.isDismissed) return '';

    var steps = ob.steps;
    var progress = ob.completedCount;
    var total = 3;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var appUrl = window.location.origin + window.location.pathname;

    // 3/3 complete — small dismissible banner (not a full card)
    if (ob.isComplete) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);border-radius:8px;margin-bottom:8px">'
            + '<span style="font-size:0.85em">🎉</span>'
            + '<span style="flex:1;font-size:0.82em;color:#22c55e;font-weight:600">Band setup complete!</span>'
            + '<button onclick="if(typeof GLStore!==\'undefined\')GLStore.dismissOnboardingCard();renderHomeDashboard()" style="background:none;border:none;color:var(--text-dim);font-size:0.72em;cursor:pointer;padding:2px 6px">Dismiss</button>'
            + '</div>';
    }

    // Incomplete — show setup card
    var pctWidth = Math.round(progress / total * 100);
    var html = '<div class="app-card home-anim-cards" style="border:1px solid rgba(99,102,241,0.2)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    html += '<h3 style="margin:0;font-size:0.95em">⚡ Complete Your Band Setup</h3>';
    html += '<span style="font-size:0.75em;font-weight:700;color:var(--accent-light)">' + progress + '/' + total + '</span>';
    html += '</div>';
    html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:10px">Set up your songs, bandmates, and rehearsal rhythm so GrooveLinx can generate insights.</div>';

    // Progress bar
    html += '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:14px;overflow:hidden">';
    html += '<div style="width:' + pctWidth + '%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:2px;transition:width 0.3s"></div>';
    html += '</div>';

    // Step 1: Add Songs
    if (steps.addSongs.complete) {
        html += _obStepDone('🎵', 'Add Songs', steps.addSongs.detail);
    } else {
        html += _obStepTodo('🎵', 'Add Songs',
            'Import your library so GrooveLinx can score readiness and build rehearsal agendas.',
            '<button onclick="if(typeof showStarterPackImport===\'function\')showStarterPackImport();else showPage(\'songs\')" class="btn btn-primary btn-sm" style="font-weight:700;font-size:0.8em">Add Starter Pack</button>'
            + '<button onclick="showPage(\'songs\')" class="btn btn-ghost btn-sm" style="font-size:0.8em">Add Songs</button>');
    }

    // Step 2: Invite Bandmates
    if (steps.inviteBandmates.complete) {
        html += _obStepDone('👥', 'Invite Bandmates', steps.inviteBandmates.detail);
    } else {
        html += _obStepTodo('👥', 'Invite Bandmates',
            'Bring your band into GrooveLinx so everyone can track readiness together.',
            '<button onclick="glShowInviteModal()" class="btn btn-primary btn-sm" style="font-weight:700;font-size:0.8em">Invite Bandmates</button>'
            + '<button onclick="glCopyInviteLink()" class="btn btn-ghost btn-sm" style="font-size:0.8em">Copy Invite Link</button>');
    }

    // Step 3: Schedule Rehearsal
    if (steps.scheduleRehearsal.complete) {
        html += _obStepDone('📅', 'Schedule Rehearsal', steps.scheduleRehearsal.detail);
    } else {
        html += _obStepTodo('📅', 'Schedule Rehearsal',
            'Set your rehearsal rhythm so GrooveLinx can build agendas and prep workflows.',
            '<button onclick="showPage(\'calendar\');setTimeout(function(){if(typeof calAddEvent===\'function\')calAddEvent()},300)" class="btn btn-primary btn-sm" style="font-weight:700;font-size:0.8em">Schedule Rehearsal</button>'
            + '<button onclick="showPage(\'calendar\')" class="btn btn-ghost btn-sm" style="font-size:0.8em">Open Calendar</button>');
    }

    html += '</div>';
    return html;
}

function _obStepDone(icon, title, detail) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.12);border-radius:8px">'
        + '<span style="font-size:1.1em">' + icon + '</span>'
        + '<div style="flex:1"><div style="font-weight:600;font-size:0.85em;color:#22c55e">✅ ' + title + '</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim)">' + _escHtml(detail) + '</div></div></div>';
}

function _obStepTodo(icon, title, desc, buttons) {
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;margin-bottom:4px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">'
        + '<span style="font-size:1.1em;margin-top:2px">' + icon + '</span>'
        + '<div style="flex:1"><div style="font-weight:600;font-size:0.85em;color:var(--text);margin-bottom:2px">' + title + '</div>'
        + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">' + desc + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + buttons + '</div></div></div>';
}

// ── Command Center: Hero + Next Best Step ─────────────────────────────────────

function _renderHeroNextBestStep(bundle, wf, isStoner) {
    var nextGig = bundle.gigs && bundle.gigs[0];
    var nextPlan = bundle.plans && bundle.plans[0];

    if (nextGig || nextPlan) {
        // Render gig/rehearsal hero, then place next-step banner BELOW it as
        // a sibling element rather than splicing into the hero HTML. This keeps
        // the hero focused on event context and puts the workflow guidance in a
        // visually distinct strip underneath.
        var heroHTML = renderHdHeroNextUp(bundle, isStoner);
        var nsBanner = _renderNextStepBannerInline(wf);
        return heroHTML + nsBanner;
    }
    // No gig or rehearsal — next step IS the hero
    return _renderWorkflowHero(wf);
}

function _renderNextStepBannerInline(wf) {
    if (!wf || !wf.nextActionLabel) return '';
    var targetActions = {
        agenda: "if(typeof GLStore!=='undefined'&&GLStore.regenerateRehearsalAgenda){GLStore.regenerateRehearsalAgenda();if(typeof renderHomeDashboard==='function')renderHomeDashboard();}",
        chopper: "if(typeof openRehearsalChopper==='function')openRehearsalChopper()",
        learn: "showPage('songs')",
        improve: "showPage('rehearsal')",
    };
    var onclick = targetActions[wf.nextActionTarget] || '';
    return '<div class="hd-cc-nextstep">'
        + '<span class="hd-cc-nextstep__icon">&#x279C;</span>'
        + '<div class="hd-cc-nextstep__text">'
        + '<span class="hd-cc-nextstep__label">' + wf.nextActionLabel + '</span>'
        + (wf.nextActionDescription ? '<span class="hd-cc-nextstep__desc">' + (wf.nextActionDescription || '') + '</span>' : '')
        + '</div>'
        + (onclick ? '<button onclick="' + onclick + '" class="hd-cc-nextstep__cta">Go</button>' : '')
        + '</div>';
}

function _renderWorkflowHero(wf) {
    var targetActions = {
        agenda: "if(typeof GLStore!=='undefined'&&GLStore.regenerateRehearsalAgenda){GLStore.regenerateRehearsalAgenda();if(typeof renderHomeDashboard==='function')renderHomeDashboard();}",
        chopper: "if(typeof openRehearsalChopper==='function')openRehearsalChopper()",
        learn: "showPage('songs')",
        improve: "showPage('rehearsal')",
    };
    var onclick = targetActions[wf.nextActionTarget] || '';
    return '<div class="hd-hero hd-hero--workflow home-anim-header">'
        + '<div class="hd-hero__eyebrow">NEXT BEST STEP</div>'
        + '<div class="hd-hero__title">' + (wf.nextActionLabel || 'Get Started') + '</div>'
        + '<div class="hd-hero__sub">' + (wf.nextActionDescription || 'Add a gig or rehearsal to begin.') + '</div>'
        + '<div class="hd-hero__actions">'
        + (onclick ? '<button class="hd-hero__cta hd-hero__cta--primary" onclick="' + onclick + '">Go</button>' : '')
        + '<button class="hd-hero__cta hd-hero__cta--secondary" onclick="showPage(\'gigs\')">Add Gig</button>'
        + '<button class="hd-hero__cta hd-hero__cta--secondary" onclick="showPage(\'rehearsal\');setTimeout(function(){if(typeof rhOpenCreateModal===\'function\')rhOpenCreateModal();},1200)">Plan Rehearsal</button>'
        + '</div></div>';
}

// ── Command Center: Band Health Row ───────────────────────────────────────────

function _renderBandHealthRow(bundle) {
    var tiles = [];

    // 1. Band Readiness %
    var pct = _computeBandReadinessPct(bundle);
    var rl = deriveHdReadinessLabel(pct);
    if (pct !== null && rl) {
        tiles.push({
            icon: '&#x1F4CA;', label: 'All Songs', value: pct + '%', sub: rl.long, color: rl.color,
            onclick: "showPage('songs')"
        });
    }

    // 2. Pocket Time
    var pt = (typeof GLStore !== 'undefined' && GLStore.getPocketTimeMetrics) ? GLStore.getPocketTimeMetrics() : null;
    if (pt) {
        var ptColor = pt.pocketTimePct >= 70 ? '#22c55e' : pt.pocketTimePct >= 50 ? '#60a5fa' : pt.pocketTimePct >= 30 ? '#f59e0b' : '#ef4444';
        tiles.push({
            icon: '&#x23F1;', label: 'Pocket Time', value: pt.pocketTimePct + '%', sub: pt.label, color: ptColor,
            onclick: "if(typeof openRehearsalChopper==='function')openRehearsalChopper()"
        });
    }

    // 3. Last Rehearsal Score
    var scData = (typeof GLStore !== 'undefined' && GLStore.getRehearsalScorecardData) ? GLStore.getRehearsalScorecardData() : null;
    if (scData && scData.latest) {
        var sc = scData.latest;
        var scColor = sc.score >= 80 ? '#22c55e' : sc.score >= 50 ? '#f59e0b' : '#ef4444';
        tiles.push({
            icon: '&#x1F3C1;', label: 'Last Score', value: String(sc.score), sub: sc.label || '', color: scColor,
            onclick: "showPage('rehearsal')"
        });
    }

    // 4. Weak Songs count
    var rc = bundle.readinessCache || {};
    var _wkSc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var _wkA = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
    var weakCount = Object.entries(rc).filter(function(e) {
        if (!_wkA[(_wkSc[e[0]]) || '']) return false;
        var keys = Object.keys(e[1] || {}).filter(function(k) { return typeof e[1][k] === 'number' && e[1][k] > 0; });
        return keys.length && _bandAvgForSong(e[1]) < 3;
    }).length;
    var wkColor = weakCount === 0 ? '#22c55e' : weakCount <= 2 ? '#f59e0b' : '#ef4444';
    tiles.push({
        icon: '&#x26A0;', label: 'Weak Songs', value: String(weakCount), sub: weakCount === 0 ? 'All clear' : 'Need work', color: wkColor,
        onclick: "showPage('songs')"
    });

    // Need at least 2 tiles for the row to feel useful — a single tile looks odd
    if (tiles.length < 2) return '';

    // Attribution line — helps users understand what unlocked these metrics
    var _healthAttrib = '';
    var _bhHelp = (typeof glInlineHelp !== 'undefined') ? glInlineHelp.renderHelpTrigger('band-health') : '';
    _healthAttrib = '<div class="hd-health-attrib"><span class="hd-health-attrib__title">Band Health</span> ' + _bhHelp + '</div>';

    var html = '<div class="hd-health-row-wrap home-anim-cards">' + _healthAttrib + '<div class="hd-health-row">';
    for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        html += '<div class="hd-health-tile" onclick="' + t.onclick + '">'
            + '<div class="hd-health-tile__icon">' + t.icon + '</div>'
            + '<div class="hd-health-tile__value" style="color:' + t.color + '">' + t.value + '</div>'
            + '<div class="hd-health-tile__label">' + t.label + '</div>'
            + (t.sub ? '<div class="hd-health-tile__sub" style="color:' + t.color + '">' + t.sub + '</div>' : '')
            + '</div>';
    }
    html += '</div></div>';
    return html;
}

// ── Command Center: Band Momentum ──────────────────────────────────────────────
// Unified directional signal: is the band improving, stable, or slipping?
// Uses existing scorecard, pocket, and readiness data. No new data loading.

function _computeBandMomentum() {
    var signals = 0; // positive = improving, negative = slipping
    var signalCount = 0;
    var reasons = [];

    // 1. Scorecard trend
    var scData = (typeof GLStore !== 'undefined' && GLStore.getRehearsalScorecardData) ? GLStore.getRehearsalScorecardData() : null;
    if (scData && scData.latest) {
        var tr = scData.latest.trend || {};
        if (tr.direction === 'improving') { signals += 2; reasons.push('Rehearsal scores improving'); }
        else if (tr.direction === 'slipping') { signals -= 2; reasons.push('Rehearsal scores slipping'); }
        signalCount++;

        // Readiness delta from last rehearsal
        var rd = scData.latest.readiness || {};
        if (rd.hasEnoughData) {
            if (rd.deltaAvg > 0.3) { signals += 1; reasons.push('Readiness up after last rehearsal'); }
            else if (rd.deltaAvg < -0.3) { signals -= 1; reasons.push('Readiness dipped after last rehearsal'); }
            signalCount++;
        }
    }

    // 2. Pocket time trend
    var pth = (typeof GLStore !== 'undefined' && GLStore.getRecentRehearsalPocketHistory) ? GLStore.getRecentRehearsalPocketHistory(5) : null;
    if (pth && pth.hasData && pth.count >= 2 && pth.entries[0].deltaPocketPct !== null) {
        if (pth.entries[0].deltaPocketPct > 3) { signals += 1; reasons.push('Groove tightening'); }
        else if (pth.entries[0].deltaPocketPct < -5) { signals -= 1; reasons.push('Groove loosening'); }
        signalCount++;
    }

    // 3. Rehearsal frequency — check if there's been a session in last 14 days
    if (scData && scData.latest) {
        var ts = scData.latest.createdAt || scData.latest.completedAt;
        if (ts) {
            var daysSince = Math.round((Date.now() - new Date(ts).getTime()) / 86400000);
            if (daysSince <= 7) { signals += 1; reasons.push('Rehearsed within the week'); }
            else if (daysSince > 21) { signals -= 1; reasons.push('No rehearsal in 3+ weeks'); }
            signalCount++;
        }
    }

    if (signalCount === 0) return null; // not enough data

    var direction, arrow, color, label;
    if (signals >= 2) {
        direction = 'improving'; arrow = '\u2191'; color = '#22c55e'; label = 'Improving';
    } else if (signals <= -2) {
        direction = 'slipping'; arrow = '\u2193'; color = '#ef4444'; label = 'Slipping';
    } else if (signals > 0) {
        direction = 'trending-up'; arrow = '\u2197'; color = '#60a5fa'; label = 'Trending Up';
    } else if (signals < 0) {
        direction = 'trending-down'; arrow = '\u2198'; color = '#f59e0b'; label = 'Drifting';
    } else {
        direction = 'stable'; arrow = '\u2192'; color = '#94a3b8'; label = 'Stable';
    }

    return {
        direction: direction,
        arrow: arrow,
        color: color,
        label: label,
        reason: reasons[0] || '',
        _signals: signals,
        _signalCount: signalCount
    };
}

function _renderBandMomentum() {
    var m = _computeBandMomentum();
    if (!m) return '';
    var _mHelp = (typeof glInlineHelp !== 'undefined') ? glInlineHelp.renderHelpTrigger('band-momentum') : '';
    return '<div class="hd-momentum">'
        + '<span class="hd-momentum__arrow" style="color:' + m.color + '">' + m.arrow + '</span>'
        + '<span class="hd-momentum__label" style="color:' + m.color + '">' + m.label + '</span>'
        + (m.reason ? '<span class="hd-momentum__reason">' + _escHtml(m.reason) + '</span>' : '')
        + _mHelp
        + '</div>';
}

// ── Narrative Bridge ──────────────────────────────────────────────────────────
// Subtle transition line between the status cluster and the action queue.
// Only shown when both Health and Queue have content.

function _renderNarrativeBridge() {
    // Only render when there's a momentum or health row above and queue below
    // The check is lightweight — if momentum computed, status section exists
    var m = _computeBandMomentum();
    if (!m) return '';
    return '<div class="hd-narrative-bridge">What to do about it</div>';
}

// ── Command Center: Priority Work Queue ───────────────────────────────────────

// ── PQ Telemetry (localStorage-only, per-device) ─────────────────────────────
// Tracks surfaces and clicks per queue item to power adaptive behavior.
// Data model: { "practice:Bertha": { s: 5, ls: 1710..., c: 1, lc: 1710... }, ... }
//   s  = surfaced count
//   ls = last surfaced timestamp (ms)
//   c  = clicked count
//   lc = last clicked timestamp (ms)

var _PQ_TELEMETRY_KEY = 'gl_pq_telemetry';
var _PQ_TELEMETRY_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days — auto-expire stale entries

function _pqLoadTelemetry() {
    try {
        var raw = localStorage.getItem(_PQ_TELEMETRY_KEY);
        if (!raw) return {};
        var data = JSON.parse(raw);
        // Prune entries older than max age
        var now = Date.now();
        var pruned = false;
        Object.keys(data).forEach(function(k) {
            if (now - (data[k].ls || 0) > _PQ_TELEMETRY_MAX_AGE) {
                delete data[k];
                pruned = true;
            }
        });
        if (pruned) localStorage.setItem(_PQ_TELEMETRY_KEY, JSON.stringify(data));
        return data;
    } catch(e) { return {}; }
}

function _pqSaveTelemetry(data) {
    try { localStorage.setItem(_PQ_TELEMETRY_KEY, JSON.stringify(data)); } catch(e) {}
}

function _pqRecordSurface(key) {
    var data = _pqLoadTelemetry();
    if (!data[key]) data[key] = { s: 0, ls: 0, c: 0, lc: 0 };
    data[key].s++;
    data[key].ls = Date.now();
    _pqSaveTelemetry(data);
}

function _pqRecordClick(key) {
    var data = _pqLoadTelemetry();
    if (!data[key]) data[key] = { s: 0, ls: 0, c: 0, lc: 0 };
    data[key].c++;
    data[key].lc = Date.now();
    _pqSaveTelemetry(data);
}

// Expose click recorder on window for inline onclick handlers
window._pqClick = function(key) { _pqRecordClick(key); };

// ── PQ Adaptive Rules ─────────────────────────────────────────────────────────
// Applied after item generation, before rendering.
//
// Rules:
// 1. Surfaced 3+ times with 0 clicks → strengthen reason wording ("still")
// 2. Clicked in last 2 hours → reduce urgency by 10 (recently acted on)
// 3. Low-priority item surfaced 5+ times with 0 clicks → drop from queue
// 4. Never suppress items with urgency >= 70 (agenda/session/gig-critical)

var _PQ_RECENTLY_ACTED_MS = 2 * 60 * 60 * 1000; // 2 hours

function _pqApplyAdaptive(items) {
    var tel = _pqLoadTelemetry();
    var now = Date.now();

    for (var i = items.length - 1; i >= 0; i--) {
        var item = items[i];
        var key = item._pqKey;
        if (!key) continue;
        var t = tel[key];
        if (!t) continue;

        // Rule 2: recently acted on → reduce urgency
        if (t.lc && (now - t.lc) < _PQ_RECENTLY_ACTED_MS) {
            item.urgency = Math.max(0, item.urgency - 10);
            continue; // skip further rules — user already engaged
        }

        // Rule 3: low-priority ignored → drop
        // Never drop items with urgency >= 70 (session, agenda, gig-critical)
        if (item.urgency < 70 && t.s >= 5 && t.c === 0) {
            items.splice(i, 1);
            continue;
        }

        // Rule 1: surfaced 3+ times with 0 clicks → strengthen wording
        if (t.s >= 3 && t.c === 0) {
            item.desc = _pqStrengthenReason(item.desc);
        }
    }
    return items;
}

function _pqStrengthenReason(desc) {
    if (!desc) return desc;
    // Avoid double-strengthening
    if (desc.indexOf('Still') === 0 || desc.indexOf('still') === 0) return desc;
    // Prefix with "Still" for persistence emphasis
    return 'Still: ' + desc.charAt(0).toLowerCase() + desc.slice(1);
}

// ── PQ Main Render ────────────────────────────────────────────────────────────

function _renderPriorityQueue(bundle) {
    var items = [];

    // Active rehearsal session — top priority
    var activeSession = (typeof GLStore !== 'undefined' && GLStore.getActiveRehearsalAgendaSession)
        ? GLStore.getActiveRehearsalAgendaSession() : null;
    if (activeSession && activeSession.status === 'active') {
        var _curItem = activeSession.items[activeSession.currentIndex];
        var _sessionDesc = _curItem
            ? 'Currently on: ' + (_curItem.title || _curItem.songId || 'song ' + (activeSession.currentIndex + 1))
            : 'Slot ' + (activeSession.currentIndex + 1) + ' of ' + activeSession.items.length;
        items.push({
            _pqKey: 'session',
            urgency: 100, label: 'Resume Rehearsal Session',
            desc: _sessionDesc,
            badge: 'IN PROGRESS', badgeColor: '#22c55e',
            cta: 'Resume', onclick: "_pqClick('session');if(typeof GLStore!=='undefined')GLStore.startRehearsalAgendaAtIndex(" + activeSession.currentIndex + ")"
        });
    }

    // Rehearsal agenda available
    var agenda = (typeof GLStore !== 'undefined' && GLStore.generateRehearsalAgenda) ? GLStore.generateRehearsalAgenda() : null;
    if (agenda && !agenda.empty && !(activeSession && activeSession.status === 'active')) {
        var _agendaDesc = agenda.summary || (agenda.items.length + ' songs \xb7 ' + agenda.totalMinutes + ' min plan ready');
        items.push({
            _pqKey: 'agenda',
            urgency: 80, label: 'Start Rehearsal',
            desc: _agendaDesc,
            badge: '', badgeColor: '',
            cta: 'Start', onclick: "_pqClick('agenda');if(typeof GLStore!=='undefined')GLStore.startRehearsalAgendaSession()"
        });
    }

    // Upload CTA — only when the band has *some* data but no recording yet.
    var tl = (typeof GLStore !== 'undefined' && GLStore.getLatestTimeline) ? GLStore.getLatestTimeline() : null;
    var hasAnyReadiness = _computeBandReadinessPct(bundle) !== null;
    if ((!tl || !tl.summary) && hasAnyReadiness) {
        var _uploadReason = 'No rehearsal recording on file yet';
        var _weakCount = Object.entries(bundle.readinessCache || {}).filter(function(e) {
            var k = Object.keys(e[1] || {}).filter(function(k) { return typeof e[1][k] === 'number' && e[1][k] > 0; });
            return k.length && _bandAvgForSong(e[1]) < 3;
        }).length;
        if (_weakCount > 0) _uploadReason = _weakCount + ' weak song' + (_weakCount !== 1 ? 's' : '') + ' \u2014 a recording would show where breakdowns happen';
        items.push({
            _pqKey: 'upload',
            urgency: 40, label: 'Upload rehearsal to improve readiness',
            desc: _uploadReason,
            badge: '', badgeColor: '',
            cta: 'Upload', onclick: "_pqClick('upload');if(typeof openRehearsalChopper==='function')openRehearsalChopper()"
        });
    }

    // Practice radar top items — cap at 2 when agenda or session is present
    var hasAgendaItem = items.length > 0;
    var prLimit = hasAgendaItem ? 2 : 3;
    var prItems = (typeof GLStore !== 'undefined' && GLStore.getPracticeAttention)
        ? GLStore.getPracticeAttention({ limit: prLimit }) : [];
    if (prItems && prItems.length) {
        for (var p = 0; p < Math.min(prLimit, prItems.length); p++) {
            var pr = prItems[p];
            var prTier = _prUrgencyTier(pr);
            var safeTitle = pr.songId.replace(/'/g, "\\'");
            var _prKey = 'practice:' + pr.songId;
            items.push({
                _pqKey: _prKey,
                urgency: 50 - p,
                label: 'Practice: ' + pr.songId,
                desc: _humanizePracticeReason(pr),
                badge: prTier.label !== 'Keep Warm' ? prTier.label.toUpperCase() : '',
                badgeColor: prTier.color,
                cta: 'Practice',
                onclick: "_pqClick('" + _prKey.replace(/'/g, "\\'") + "');showPage('songs');setTimeout(function(){if(typeof GLStore!=='undefined')GLStore.selectSong('" + safeTitle + "');if(typeof highlightSelectedSongRow==='function')highlightSelectedSongRow('" + safeTitle + "');},200)"
            });
        }
    }

    // Apply adaptive rules before sorting
    _pqApplyAdaptive(items);

    // Sort by urgency, cap at 5
    items.sort(function(a, b) { return b.urgency - a.urgency; });
    items = items.slice(0, 5);

    if (!items.length) {
        // Context-specific empty state based on data maturity
        var _pqEmptyMsg = 'The queue populates as you add songs and rate readiness.';
        var _pqEmptyCta = '<button class="hd-setup-step__cta" style="margin-top:8px" onclick="showPage(\'songs\')">Go to Songs &#x2192;</button>';
        var _rcKeys = Object.keys(bundle.readinessCache || {});
        var _ratedN = _rcKeys.filter(function(k) { var v = Object.values(bundle.readinessCache[k] || {}).filter(function(v){return typeof v==='number'&&v>0;}); return v.length; }).length;
        if (_ratedN === 0) {
            _pqEmptyMsg = 'Rate readiness on a few songs to see what the band should work on next.';
        } else if (_ratedN < 5) {
            _pqEmptyMsg = _ratedN + ' song' + (_ratedN !== 1 ? 's' : '') + ' rated. Rate a few more to unlock prioritized practice suggestions.';
        } else if (!(bundle.gigs && bundle.gigs.length)) {
            _pqEmptyMsg = 'Readiness looks good. Add a gig to unlock gig-specific prep recommendations.';
            _pqEmptyCta = '<button class="hd-setup-step__cta" style="margin-top:8px" onclick="showPage(\'gigs\')">Add Gig &#x2192;</button>';
        }
        return '<div class="hd-pq home-anim-cards">'
            + '<div class="hd-pq__header">Priority Queue ' + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('priority-queue') : '') + '</div>'
            + '<div class="hd-pq__empty">' + _pqEmptyMsg + '</div>'
            + _pqEmptyCta
            + '</div>';
    }

    // Record surfaces for all rendered items
    for (var s = 0; s < items.length; s++) {
        if (items[s]._pqKey) _pqRecordSurface(items[s]._pqKey);
    }

    var html = '<div class="hd-pq home-anim-cards">'
        + '<div class="hd-pq__header">Priority Queue ' + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('priority-queue') : '') + '</div>';

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var badgeHTML = item.badge
            ? '<span class="hd-pq__badge" style="background:' + item.badgeColor + '18;color:' + item.badgeColor + ';border-color:' + item.badgeColor + '44">' + item.badge + '</span>'
            : '';
        html += '<div class="hd-pq__item">'
            + '<span class="hd-pq__rank">' + (i + 1) + '</span>'
            + '<div class="hd-pq__body">'
            + '<div class="hd-pq__label">' + _escHtml(item.label) + ' ' + badgeHTML + '</div>'
            + '<div class="hd-pq__desc">' + _escHtml(item.desc) + '</div>'
            + '</div>'
            + '<button class="hd-pq__cta" onclick="' + item.onclick + '">' + item.cta + ' &#x2192;</button>'
            + '</div>';
    }

    html += '</div>';
    return html;
}

// ── Command Center: Impact Feedback ───────────────────────────────────────────
// Detects measurable improvements from recommended actions.
// Returns 0-2 concise feedback messages using existing data.

function _detectImpactFeedback() {
    var messages = [];

    // 1. Scorecard readiness improvements
    var scData = (typeof GLStore !== 'undefined' && GLStore.getRehearsalScorecardData) ? GLStore.getRehearsalScorecardData() : null;
    if (scData && scData.latest) {
        var sc = scData.latest;
        var rd = sc.readiness || {};
        // Check if readiness improved for specific songs
        if (rd.hasEnoughData && rd.improvedSongs && rd.improvedSongs.length > 0) {
            var topImproved = rd.improvedSongs[0];
            if (topImproved && topImproved.title) {
                messages.push({
                    icon: '&#x2B06;',
                    text: 'Last rehearsal improved readiness for ' + _escHtml(topImproved.title),
                    color: '#22c55e'
                });
            }
        } else if (rd.hasEnoughData && rd.deltaAvg > 0) {
            messages.push({
                icon: '&#x2B06;',
                text: 'Rehearsal lifted band readiness by +' + rd.deltaAvg + ' avg',
                color: '#22c55e'
            });
        }
        // Biggest win from highlights
        var hl = sc.highlights || {};
        if (hl.biggestWin && !messages.length) {
            messages.push({
                icon: '&#x1F3C6;',
                text: _escHtml(hl.biggestWin),
                color: '#22c55e'
            });
        }
    }

    // 2. Pocket time improvement
    if (messages.length < 2) {
        var pth = (typeof GLStore !== 'undefined' && GLStore.getRecentRehearsalPocketHistory) ? GLStore.getRecentRehearsalPocketHistory(3) : null;
        if (pth && pth.hasData && pth.count >= 2 && pth.entries[0].deltaPocketPct > 0) {
            messages.push({
                icon: '&#x1F3AF;',
                text: 'Groove tightened \u2014 pocket time up ' + pth.entries[0].deltaPocketPct + ' points from last session',
                color: '#22c55e'
            });
        }
    }

    // 3. Songs that crossed into gig-ready since last check
    if (messages.length < 2) {
        var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var statusMap = (typeof GLStore !== 'undefined' && GLStore.getAllStatus) ? GLStore.getAllStatus() : {};
        // Find songs where avg >= 4 but status was not gig_ready — implies recent improvement
        var newlyReady = [];
        Object.entries(rc).forEach(function(e) {
            var title = e[0];
            var avg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;
            if (!avg) return;
            var status = statusMap[title] || '';
            // High readiness but status hasn't caught up yet
            if (avg >= 4 && status === 'wip') {
                newlyReady.push(title);
            }
        });
        if (newlyReady.length === 1) {
            messages.push({
                icon: '&#x2705;',
                text: 'Practice paid off \u2014 ' + _escHtml(newlyReady[0]) + ' is now gig-ready',
                color: '#22c55e'
            });
        } else if (newlyReady.length > 1) {
            messages.push({
                icon: '&#x2705;',
                text: newlyReady.length + ' songs now at gig-ready readiness \u2014 consider updating their status',
                color: '#22c55e'
            });
        }
    }

    // 4. Milestone unlock events (progressive discovery ladder)
    // Show once per milestone, then persist so it doesn't repeat.
    if (messages.length < 3) {
        var _unlockKey = 'gl_cc_unlocks';
        var _seen = {};
        try { _seen = JSON.parse(localStorage.getItem(_unlockKey) || '{}'); } catch(e) {}
        var _newUnlocks = [];
        var rc2 = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var ratedN = Object.keys(rc2).filter(function(k) {
            return Object.values(rc2[k] || {}).some(function(v) { return typeof v === 'number' && v > 0; });
        }).length;

        // Practice radar unlocked (5+ songs rated)
        if (ratedN >= 5 && !_seen.radar) {
            _newUnlocks.push({ id: 'radar', icon: '&#x1F4E1;', text: 'Practice Radar unlocked \u2014 based on your readiness ratings', color: '#818cf8' });
        }
        // Gig risk unlocked (has a gig with linked setlist)
        var _hasGigScope = false;
        try {
            var _gigs = (typeof window._homeBundle !== 'undefined' && _homeBundle) ? _homeBundle.gigs : [];
            _hasGigScope = _gigs && _gigs.length && (_gigs[0].setlistId || _gigs[0].linkedSetlist);
        } catch(e2) {}
        if (_hasGigScope && !_seen.gigrisk) {
            _newUnlocks.push({ id: 'gigrisk', icon: '&#x1F6A8;', text: 'Gig risk analysis active \u2014 tracking your setlist readiness', color: '#818cf8' });
        }
        // Scorecard unlocked (first rehearsal completed)
        if (scData && scData.latest && !_seen.scorecard) {
            _newUnlocks.push({ id: 'scorecard', icon: '&#x1F3C1;', text: 'Rehearsal Scorecard unlocked \u2014 from your rehearsal session data', color: '#818cf8' });
        }
        // Segmentation unlocked (first recording analyzed)
        var _hasTl = (typeof GLStore !== 'undefined' && GLStore.getLatestTimeline) ? GLStore.getLatestTimeline() : null;
        if (_hasTl && _hasTl.summary && !_seen.segmentation) {
            _newUnlocks.push({ id: 'segmentation', icon: '&#x1F50D;', text: 'Rehearsal insights unlocked \u2014 from your uploaded recording', color: '#818cf8' });
        }

        // Show up to 1 unlock per render (avoid flood), persist it
        if (_newUnlocks.length) {
            var unlock = _newUnlocks[0];
            messages.push(unlock);
            _seen[unlock.id] = Date.now();
            try { localStorage.setItem(_unlockKey, JSON.stringify(_seen)); } catch(e) {}
        }
    }

    return messages.slice(0, 3);
}

// ── Command Center: Recent Changes ────────────────────────────────────────────

function _renderRecentChanges(bundle) {
    var hasMeaningfulContent = false;
    var sections = [];

    // Impact feedback — show improvements first
    var impacts = _detectImpactFeedback();
    if (impacts.length) {
        hasMeaningfulContent = true;
        var impactHTML = '<div class="hd-changes__impacts">';
        for (var im = 0; im < impacts.length; im++) {
            impactHTML += '<div class="hd-changes__impact">'
                + '<span class="hd-changes__impact-icon">' + impacts[im].icon + '</span>'
                + '<span class="hd-changes__impact-text" style="color:' + impacts[im].color + '">' + impacts[im].text + '</span>'
                + '</div>';
        }
        impactHTML += '</div>';
        sections.push(impactHTML);
    }

    // Latest scorecard headline
    var scData = (typeof GLStore !== 'undefined' && GLStore.getRehearsalScorecardData) ? GLStore.getRehearsalScorecardData() : null;
    if (scData && scData.latest) {
        hasMeaningfulContent = true;
        var sc = scData.latest;
        var tsField = sc.createdAt || sc.completedAt;
        var recency = '';
        if (tsField) {
            var ms = Date.now() - new Date(tsField).getTime();
            var mins = Math.round(ms / 60000);
            if (mins < 60) recency = mins + ' min ago';
            else if (mins < 1440) recency = Math.round(mins / 60) + 'h ago';
            else recency = Math.round(mins / 1440) + 'd ago';
        }
        var scColor = sc.score >= 80 ? '#22c55e' : sc.score >= 50 ? '#f59e0b' : '#ef4444';
        sections.push('<div class="hd-changes__scorecard">'
            + '<span style="font-size:0.65em;color:var(--text-dim,#475569);margin-right:4px">Last rehearsal</span>'
            + '<span style="font-weight:800;color:' + scColor + '">' + sc.score + '</span>'
            + '<span class="hd-changes__sc-label">' + _escHtml(sc.headline || sc.label || 'Complete') + '</span>'
            + (recency ? '<span class="hd-changes__sc-time">' + recency + '</span>' : '')
            + '</div>');
    }

    // Compact timeline strip
    var ri = (typeof GLStore !== 'undefined' && GLStore.getRehearsalIntelligence) ? GLStore.getRehearsalIntelligence() : null;
    if (ri && ri.hasData && ri.stripSegments && ri.stripSegments.length) {
        hasMeaningfulContent = true;
        var kindColors = { music: '#667eea', speech: '#f59e0b', silence: '#334155', unknown: '#1e293b', excluded: '#1e293b' };
        var _tlHelp = (typeof glInlineHelp !== 'undefined') ? glInlineHelp.renderHelpTrigger('rehearsal-timeline') : '';
        var strip = '<div class="hd-changes__timeline" title="Last rehearsal \xb7 ' + ri.totalDurationMin + ' min">' + '<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><span style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase">Rehearsal Timeline</span>' + _tlHelp + '</div>';
        strip += '<div class="hd-changes__strip">';
        for (var s = 0; s < ri.stripSegments.length; s++) {
            var seg = ri.stripSegments[s];
            var c = kindColors[seg.kind] || '#1e293b';
            var op = seg.kind === 'silence' ? '0.3' : '0.8';
            strip += '<div style="position:absolute;left:' + seg.startPct.toFixed(2) + '%;width:' + Math.max(seg.widthPct, 0.3).toFixed(2) + '%;height:100%;background:' + c + ';opacity:' + op + '"></div>';
        }
        strip += '</div>';
        strip += '<div class="hd-changes__strip-meta">' + ri.totalDurationMin + ' min \xb7 ' + (ri.musicSegments || 0) + ' music \xb7 ' + (ri.restartCount || 0) + ' restarts</div>';
        strip += '</div>';
        sections.push(strip);
    }

    // Activity feed — only include if we have some meaningful anchor content above,
    // otherwise the section is just generic activity which isn't worth a card.
    if (hasMeaningfulContent) {
        sections.push('<div id="home-activity-feed" class="home-activity"></div>');
        setTimeout(function() {
            var el = document.getElementById('home-activity-feed');
            if (!el) return;
            _loadActivityFeed().then(function(entries) {
                if (!entries || !entries.length) { el.style.display = 'none'; return; }
                el.innerHTML = '<div class="home-activity__title">Recent Activity</div>'
                    + entries.map(function(e) {
                        return '<div class="home-activity__item">'
                            + '<span class="home-activity__text">' + _escHtml(_activityLabel(e)) + '</span>'
                            + '<span class="home-activity__time">' + _activityTimeAgo(e.time) + '</span>'
                            + '</div>';
                    }).join('');
            });
        }, 300);
    }

    if (!sections.length) return '';
    return '<details class="hd-changes home-anim-feed" style="cursor:pointer">'
        + '<summary class="hd-changes__header" style="list-style:none;display:flex;align-items:center;gap:6px;cursor:pointer">▸ What Changed ' + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('impact-feedback') : '') + '</summary>'
        + sections.join('')
        + '</details>';
}

// ── Mission Board Helpers ────────────────────────────────────────────────────

function deriveHdReadinessLabel(pct) {
    if (pct === null || pct === undefined) return null;
    if (pct >= 85) return { short: 'GIG READY',            long: 'Gig Ready',           color: 'var(--green)', tone: 'ready'   };
    if (pct >= 68) return { short: 'MINOR TUNE-UP NEEDED', long: 'Minor tune-up needed', color: '#fbbf24',      tone: 'caution' };
    if (pct >= 50) return { short: 'NEEDS REHEARSAL',      long: 'Needs rehearsal',      color: '#f97316',      tone: 'warning' };
    return             { short: 'CRITICAL PREP',           long: 'Critical prep needed', color: '#ef4444',      tone: 'critical'};
}

function deriveHdConfidenceTone(bundle) {
    return deriveHdReadinessLabel(_computeBandReadinessPct(bundle));
}

function deriveHdMissionSummary(bundle) {
    var pct=_computeBandReadinessPct(bundle),rc=bundle.readinessCache||{},nextGig=bundle.gigs&&bundle.gigs[0],nextPlan=bundle.plans&&bundle.plans[0],rl=deriveHdReadinessLabel(pct);
    var _msSc=(typeof statusCache!=='undefined')?statusCache:{},_msA={prospect:1,learning:1,rotation:1,gig_ready:1};
    var we=Object.entries(rc).filter(function(e){return _msA[(_msSc[e[0]])||'']&&e[1]&&_bandAvgForSong(e[1])<3;}),wc=we.length,tw=we.sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);})[0];
    var line1='',line2='';
    if(nextGig){var diff=nextGig.date?_dayDiff(_todayStr(),nextGig.date):null,when=diff===0?'Tonight':diff===1?'Tomorrow':(nextGig.date?_formatDateShort(nextGig.date):'');line1=_escHtml(nextGig.venue||'Your next show')+' is next.';if(rl&&wc===0)line1+=' Your band is '+rl.long.toLowerCase()+'.';else if(rl)line1+=' Your band is '+rl.long.toLowerCase()+', but '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work.';var d2=[];if(when)d2.push(when);if(nextGig.startTime)d2.push('Set '+_escHtml(nextGig.startTime));if(tw)d2.push('Focus: '+_escHtml(tw[0]));if(nextGig.linkedSetlist)d2.push('Setlist: '+_escHtml(nextGig.linkedSetlist));line2=d2.join(' \xb7 ');
    }else if(nextPlan){var diff2=nextPlan.date?_dayDiff(_todayStr(),nextPlan.date):null,when2=diff2===0?'Tonight':diff2===1?'Tomorrow':(nextPlan.date?_formatDateShort(nextPlan.date):'');line1='Rehearsal '+(when2?when2.toLowerCase():'coming up')+'.';if(rl&&wc>0)line1+=' '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work before then.';else if(rl)line1+=' Band is '+rl.long.toLowerCase()+'.';if(tw)line2='Focus: '+_escHtml(tw[0]);
    }else{line1=rl?'Band is '+rl.long.toLowerCase()+'.':'No upcoming events scheduled.';if(wc>0)line1+=' '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work.';}
    return {line1:line1,line2:line2,rl:rl,weakCount:wc,topWeak:tw};
}

function deriveHdPrepFocus(bundle) {
    var rc=bundle.readinessCache||{},myKey=bundle.memberKey,nextGig=bundle.gigs&&bundle.gigs[0];
    if(!myKey)return null;
    var weak=[];
    var _wpSc=(typeof statusCache!=='undefined')?statusCache:{},_wpA={prospect:1,learning:1,rotation:1,gig_ready:1};
    Object.entries(rc).forEach(function(e){var t=e[0];if(!_wpA[(_wpSc[t])||''])return;var r=e[1]||{},m=r[myKey];if(typeof m==='number'&&m>0&&m<3){var rs=m<=1?['Low readiness']:['Needs work'];if(_bandAvgForSong(r)<3)rs.push('Band also needs work');weak.push({title:t,score:m,reasons:rs});}});
    weak.sort(function(a,b){return a.score-b.score;});
    if(!weak.length)return{empty:true};
    return{top:weak[0],rest:weak.slice(1),total:weak.length,eventTie:nextGig?('Needed for '+_escHtml(nextGig.venue||'your next show')):null};
}

function deriveHdBandIntel(bundle) {
    var pct=_computeBandReadinessPct(bundle),rc=bundle.readinessCache||{},rl=deriveHdReadinessLabel(pct),nextPlan=bundle.plans&&bundle.plans[0],nextGig=bundle.gigs&&bundle.gigs[0],lines=[];
    if(pct!==null&&rl)lines.push({label:'Readiness',icon:'\ud83d\udcca',value:pct+'% \u2014 '+rl.long,color:rl.color});
    if(nextPlan){var diff=nextPlan.date?_dayDiff(_todayStr(),nextPlan.date):null,dl=diff===0?'Tonight':diff===1?'Tomorrow':_formatDateShort(nextPlan.date),ps=(nextPlan.plan&&Array.isArray(nextPlan.plan.songs))?nextPlan.plan.songs.length:0;lines.push({label:'Next rehearsal',icon:'\ud83d\udcc5',value:dl+(ps?' \xb7 '+ps+' songs planned':'')}); }
    if(nextGig&&nextGig.linkedSetlist){var slR=_computeSetlistReadiness(nextGig,rc);lines.push({label:'Setlist',icon:'\ud83c\udfb6',value:_escHtml(nextGig.linkedSetlist)+(slR?' \xb7 '+slR:'')});}
    var _biSc=(typeof statusCache!=='undefined')?statusCache:{},_biA={prospect:1,learning:1,rotation:1,gig_ready:1};
    var we=Object.entries(rc).filter(function(e){return _biA[(_biSc[e[0]])||'']&&e[1]&&_bandAvgForSong(e[1])<3;});
    if(we.length){var top=we.sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);})[0];lines.push({label:'Biggest risk',value:_escHtml(top[0]),color:'#f97316'});}
    return lines.slice(0,4);
}

// ── Gig Confidence Meter ──────────────────────────────────────────────────────
// ── Poll Card for Command Center ─────────────────────────────────────────────

async function _renderHdPollCard() {
    var el = document.getElementById('hdPollCard');
    if (!el) return;
    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath === 'function') {} else return;
        // Use canonical vote key (display name) for consistent identity
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var userId = fas ? fas.getMyVoteKey() : null;
        if (!userId) userId = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'me';
        var cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

        // Load polls, ideas in parallel
        var pollSnap = await firebaseDB.ref(bandPath('polls')).orderByChild('ts').limitToLast(5).once('value');
        var ideasSnap = await firebaseDB.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(3).once('value');

        var polls = pollSnap.val() ? Object.entries(pollSnap.val()).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); }) : [];
        polls.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
        var recentPolls = polls.filter(function(p) { return p.ts > cutoff && p.options && p.options.length; });
        var unanswered = recentPolls.filter(function(p) { return !p.votes || p.votes[userId] === undefined; }).length;

        var ideas = ideasSnap.val() ? Object.entries(ideasSnap.val()).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); }) : [];
        ideas.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
        var recentIdeas = ideas.filter(function(i) { return i.ts > cutoff; });

        var updateCount = recentPolls.length + recentIdeas.length;
        if (!updateCount) { el.innerHTML = ''; return; }

        // Build compact Band Room summary
        var _previewText = '';
        if (recentPolls.length) _previewText = recentPolls[0].question || 'New poll';
        else if (recentIdeas.length) _previewText = recentIdeas[0].text || recentIdeas[0].title || 'New idea';

        var html = '<details style="margin-top:8px"><summary style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);cursor:pointer;list-style:none;font-size:0.78em">'
            + '<span style="font-size:1em">🎸</span>'
            + '<span style="font-weight:600;color:var(--text-muted,#94a3b8);flex:1">Band Room</span>'
            + (unanswered > 0 ? '<span style="background:rgba(251,191,36,0.15);color:#fbbf24;border-radius:10px;padding:1px 7px;font-size:0.82em;font-weight:700">' + unanswered + '</span>' : '<span style="color:var(--text-dim);font-size:0.85em">' + updateCount + '</span>')
            + '<span style="color:var(--text-dim);font-size:0.85em">\u25B6</span>'
            + '</summary>'
            + '<div style="padding:8px 14px">'
            + '<div style="font-size:0.75em;color:var(--text-dim);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escHtml(_previewText) + '</div>';

        // Polls section
        if (recentPolls.length) {
            recentPolls.slice(0, 2).forEach(function(p) {
                var votes = p.votes || {};
                var myVote = votes[userId];
                var totalVotes = Object.keys(votes).length;
                html += '<div style="padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px">';
                html += '<div style="font-weight:600;font-size:0.85em;color:var(--text);margin-bottom:4px">' + _escHtml(p.question) + '</div>';
                (p.options || []).forEach(function(opt, i) {
                    var count = Object.values(votes).filter(function(v) { return v === i; }).length;
                    var pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
                    var isMyVote = myVote === i;
                    html += '<div onclick="_hdVotePoll(\'' + p._key + '\',' + i + ')" style="display:flex;align-items:center;gap:6px;padding:3px 6px;margin-bottom:2px;border-radius:4px;cursor:pointer;background:' + (isMyVote ? 'rgba(99,102,241,0.1)' : 'transparent') + '">';
                    html += '<div style="flex:1;font-size:0.8em;color:var(--text-muted)">' + _escHtml(opt) + '</div>';
                    html += '<div style="width:40px;background:rgba(255,255,255,0.06);border-radius:3px;height:14px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + (isMyVote ? '#818cf8' : 'rgba(255,255,255,0.15)') + ';border-radius:3px"></div></div>';
                    html += '<span style="font-size:0.7em;color:var(--text-dim);min-width:18px;text-align:right">' + count + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            });
        }

        // Ideas section
        if (recentIdeas.length) {
            html += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;margin-top:4px">';
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Recent Ideas</div>';
            recentIdeas.slice(0, 3).forEach(function(idea) {
                html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.82em">';
                html += '<span style="color:var(--accent-light)">💡</span>';
                html += '<span style="color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escHtml(idea.title || '') + '</span>';
                html += '<span style="color:var(--text-dim);font-size:0.75em;flex-shrink:0">' + _escHtml(idea.author || '') + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '<div style="text-align:center;padding:6px 0 0"><button onclick="showPage(\'ideas\')" class="btn btn-ghost btn-sm" style="font-size:0.75em">Open Band Room \u2192</button></div>';
        html += '</div></details>';
        el.innerHTML = html;
    } catch(e) { el.innerHTML = ''; }
}

window._hdVotePoll = async function(pollKey, optionIdx) {
    // Route through canonical vote path to ensure consistent vote key (display name)
    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    if (fas && fas.voteOnPoll) {
        var result = await fas.voteOnPoll(pollKey, optionIdx);
        if (result.ok) {
            if (typeof showToast === 'function') showToast('Vote recorded');
        } else {
            if (typeof showToast === 'function') showToast('Vote failed: ' + (result.reason || 'unknown'));
        }
    } else {
        // Legacy fallback — should not be reached
        var voteKey = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'me';
        try {
            if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
                await firebaseDB.ref(bandPath('polls/' + pollKey + '/votes/' + voteKey)).set(optionIdx);
                if (typeof showToast === 'function') showToast('Vote recorded');
            }
        } catch(e) {}
    }
    _renderHdPollCard();
};

// Executive summary of show readiness. Complements the granular readiness %
// with qualitative confidence based on multiple signals.
//
// Inputs: readiness %, risk count, rehearsal recency, scorecard trend, pocket trend
// Output: { level, label, color, reasons[] }

function _computeGigConfidence(opts) {
    var pct = opts.readinessPct;          // 0-100 or null
    var riskCount = opts.riskCount || 0;  // songs below threshold on setlist
    var setlistSize = opts.setlistSize || 0;
    var hasRecentRehearsal = opts.hasRecentRehearsal || false;
    var rehearsalImproved = opts.rehearsalImproved || false;
    var scorecardTrend = opts.scorecardTrend || null;   // 'improving' | 'slipping' | 'steady' | null
    var pocketDelta = opts.pocketDelta || 0;            // positive = tighter

    if (pct === null) return null; // not enough data

    // ── Additive heuristic model ──────────────────────────────────────────
    // Score built from zero. Readiness is the anchor (~50% of max), other
    // signals adjust up/down. Designed so a well-prepared band realistically
    // reaches "Strong" and a typical band lands in the middle of the range.
    //
    // Max possible: 50 (readiness) + 10 (rehearsal) + 10 (improved) +
    //               10 (trend) + 5 (pocket) = 85
    // Thresholds tuned so that:
    //   - 85% ready + rehearsed + improving = Strong (~70+)
    //   - 70% ready + rehearsed = Solid (~55+)
    //   - 55% ready + some work = Trending Up (~40+)
    //   - 40% ready + issues = Cautious (~25+)
    //   - Below that = At Risk
    var score = 0;
    // Collect all candidate reasons with priority weights.
    // After scoring, sort by weight and take top 2.
    var _rc = []; // { w: weight, t: text }

    // Setlist readiness — smooth curve, biggest contributor (0-50 pts)
    if (pct >= 85) {
        score += 50;
        if (riskCount === 0) _rc.push({ w: 50, t: 'Most setlist songs are gig-ready' });
    } else if (pct >= 70) {
        score += 35 + Math.round((pct - 70) / 15 * 15);
    } else if (pct >= 50) {
        score += 20 + Math.round((pct - 50) / 20 * 15);
    } else if (pct >= 30) {
        score += 10;
    }

    // Risk songs penalty
    if (riskCount > 0) {
        var _riskPenalty = Math.min(15, riskCount * 4);
        score -= _riskPenalty;
        var _riskText = riskCount >= 3
            ? riskCount + ' songs still need work before the gig'
            : riskCount + ' song' + (riskCount !== 1 ? 's' : '') + ' still need' + (riskCount === 1 ? 's' : '') + ' work';
        _rc.push({ w: 40 + riskCount * 5, t: _riskText });
    }

    // Rehearsal recency (14-day window)
    if (hasRecentRehearsal) {
        score += 10;
    } else {
        score -= 8;
        _rc.push({ w: 35, t: 'No rehearsal recorded in the past 2 weeks' });
    }

    // Rehearsal improved readiness
    if (rehearsalImproved) {
        score += 10;
        _rc.push({ w: 30, t: 'Last rehearsal improved readiness' });
    }

    // Pocket trend
    if (pocketDelta > 3) {
        score += 5;
        _rc.push({ w: 10, t: 'Groove getting tighter' });
    } else if (pocketDelta < -5) {
        score -= 5;
        _rc.push({ w: 15, t: 'Groove has loosened since last session' });
    }

    // Scorecard trend
    if (scorecardTrend === 'improving') {
        score += 10;
        _rc.push({ w: 20, t: 'Rehearsal trend is improving' });
    } else if (scorecardTrend === 'slipping') {
        score -= 8;
        _rc.push({ w: 25, t: 'Rehearsal scores have been slipping' });
    }

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));

    // ── Map to qualitative levels ─────────────────────────────────────────
    // Strong (70+) / Solid (55-69) / Trending Up (40-54) / Cautious (25-39) / At Risk (<25)
    var level, label, color;
    if (score >= 70) {
        level = 'strong'; label = 'Strong'; color = '#22c55e';
    } else if (score >= 55) {
        level = 'solid'; label = 'Solid'; color = '#60a5fa';
    } else if (score >= 40) {
        level = 'trending'; label = 'Trending Up'; color = '#818cf8';
    } else if (score >= 25) {
        level = 'cautious'; label = 'Cautious'; color = '#f59e0b';
    } else {
        level = 'atrisk'; label = 'At Risk'; color = '#ef4444';
    }

    // Sort reasons by weight (strongest signal first), take top 2
    _rc.sort(function(a, b) { return b.w - a.w; });
    var reasons = _rc.slice(0, 2).map(function(r) { return r.t; });

    return {
        level: level,
        label: label,
        color: color,
        reasons: reasons,
        _score: score
    };
}

function _renderGigConfidence(conf) {
    if (!conf) return '';
    var reasonHTML = conf.reasons.length
        ? '<div class="hd-conf__reasons">' + conf.reasons.map(function(r) { return '<span class="hd-conf__reason">' + _escHtml(r) + '</span>'; }).join(' \xb7 ') + '</div>'
        : '';
    return '<div class="hd-conf" style="border-color:' + conf.color + '33">'
        + '<div class="hd-conf__header">'
        + '<span class="hd-conf__label">Gig Confidence ' + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('gig-confidence') : '') + '</span>'
        + '<span class="hd-conf__level" style="color:' + conf.color + '">' + conf.label + '</span>'
        + '</div>'
        + reasonHTML
        + '</div>';
}

function renderHdHeroNextUp(bundle, isStoner) {
    var nextGig  = bundle.gigs  && bundle.gigs[0];
    var nextPlan = bundle.plans && bundle.plans[0];
    if (nextGig)  return _renderHdHeroGig(nextGig, bundle, isStoner);
    if (nextPlan) return _renderHdHeroRehearsal(nextPlan, bundle);
    return [
        '<div class="hd-hero hd-hero--empty home-anim-header">',
        '<div class="hd-hero__eyebrow">NEXT UP</div>',
        '<div class="hd-hero__title">Nothing Scheduled Yet</div>',
        '<div class="hd-hero__sub">Add a gig or rehearsal to get started.</div>',
        '<div class="hd-hero__actions">',
        '<button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'gigs\')">Add Gig</button>',
        '<button class="hd-hero__cta hd-hero__cta--secondary" onclick="showPage(\'rehearsal\')">Plan Rehearsal</button>',
        '</div></div>'
    ].join('');
}

function _renderHdHeroGig(gig, bundle, isStoner) {
  try {
    var ls      = gig.setlistId || gig.linkedSetlist || null;
    var lsEsc   = ls ? _escHtml(ls) : '';
    var venue   = _escHtml(gig.venue || 'Upcoming Show');
    var diff    = gig.date ? _dayDiff(_todayStr(), gig.date) : null;
    var isToday = diff === 0;
    var isSoon  = diff !== null && diff <= 2;
    var dateLbl = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(gig.date);
    var timeLbl = '';
    if (gig.doorsTime) timeLbl = 'Doors ' + _escHtml(gig.doorsTime);
    if (gig.startTime) timeLbl = (timeLbl ? timeLbl + ' \xb7 ' : '') + 'Set ' + _escHtml(gig.startTime);
    var urgency = isToday ? 'hd-hero--gig hd-hero--urgent' : isSoon ? 'hd-hero--gig hd-hero--soon' : 'hd-hero--gig';
    var badge   = isToday ? '<span class="hd-hero__badge hd-hero__badge--live">TONIGHT</span>'
                : diff === 1 ? '<span class="hd-hero__badge hd-hero__badge--soon">TOMORROW</span>'
                : isSoon ? '<span class="hd-hero__badge hd-hero__badge--soon">IN ' + diff + ' DAYS</span>' : '';
    var readHTML = isStoner ? '' : _renderSetlistReadinessBars(gig, bundle.readinessCache);
    var warnHTML = isStoner ? '' : _renderReadinessWarnings(gig, bundle.readinessCache);
    // Show setlist name + song count (not raw ID)
    var _slName = '';
    var _slSongCount = _gigSongScope ? Object.keys(_gigSongScope).length : 0;
    if (_slMatch) _slName = _slMatch.name || '';
    var slLine = ls ? '<div class="hd-hero__setlist" style="font-size:0.78em;color:var(--text-muted)">' + (_slName ? _escHtml(_slName) : 'Setlist linked') + (_slSongCount ? ' · ' + _slSongCount + ' songs' : '') + '</div>' : '';
    // Build gig-scoped song set for readiness/risk computation.
    // Resolve setlist by setlistId first, then name fallback.
    var _gigSongScope = {};
    if (ls) {
        var _slSources = [];
        if (bundle && bundle.setlists && Array.isArray(bundle.setlists)) _slSources = _slSources.concat(bundle.setlists);
        // Use centralized setlist cache (both window globals now point to same reference via GLStore)
        var _centralSl = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : (window._glCachedSetlists || window._cachedSetlists || []);
        if (_centralSl.length) _slSources = _slSources.concat(_centralSl);
        // Match by setlistId first (canonical), then by name (legacy fallback)
        var _slMatch = _slSources.find(function(sl) { return sl.setlistId && sl.setlistId === ls; })
                    || _slSources.find(function(sl) { return (sl.name||'') === ls; });
        if (_slMatch && _slMatch.sets) {
            for (var _si = 0; _si < _slMatch.sets.length; _si++) {
                var _ss = _slMatch.sets[_si].songs || [];
                for (var _sj = 0; _sj < _ss.length; _sj++) { var _st = _ss[_sj].title || _ss[_sj]; if (_st) _gigSongScope[_st] = true; }
            }
        }
    }
    var _hasScope = Object.keys(_gigSongScope).length > 0;
    var pct=_computeBandReadinessPct(bundle, _hasScope ? _gigSongScope : null),rl=deriveHdReadinessLabel(pct);
    var rb=rl?'<span class="hd-hero__ready-badge" style="background:'+rl.color+'22;color:'+rl.color+';border-color:'+rl.color+'55">'+rl.short+'</span>':'' ;
    // Biggest risk song — strictly scoped to setlist when linked.
    // If setlist linked but not resolved, show NO risk entry (don't leak global pool).
    var rc2 = bundle.readinessCache || {};
    var riskEntries = [];
    if (ls && !_hasScope) {
        // Setlist linked but resolution failed — no risk entry, safe fallback
        riskEntries = [];
    } else {
        riskEntries = Object.entries(rc2)
            .filter(function(e) { return e[1] && _bandAvgForSong(e[1]) < 3 && (!_hasScope || _gigSongScope[e[0]]); })
            .sort(function(a,b) { return _bandAvgForSong(a[1]) - _bandAvgForSong(b[1]); });
    }
    var riskEntry = riskEntries[0];
    // Coach text — uses gig-scoped riskEntry
    var coach='';
    var _coachSong = riskEntry ? _escHtml(riskEntry[0]) : null;
    if(rl&&rl.tone==='ready')coach=_coachSong?'You\'re gig-ready — tighten '+_coachSong+' and you\'re golden.':'You\'re gig-ready. Go crush it.';
    else if(rl&&rl.tone==='caution')coach=_coachSong?'Almost there — run '+_coachSong+' one more time.':'One more run-through and you\'re ready.';
    else if(rl)coach='You need a rehearsal before this gig.';
    var cd='';
    var cdInline=diff!==null&&diff>1?' · <span class="hd-hero__days-away">'+diff+'d away</span>':diff===1?' · <span class="hd-hero__days-away">Tomorrow</span>':'';
    // Readiness progress bar
    var pctColor = pct >= 85 ? 'var(--green)' : pct >= 68 ? '#fbbf24' : pct >= 50 ? '#f97316' : '#ef4444';
    var rlLabel = rl ? rl.long : '';
    var pctClickAction = ls ? 'homeViewSetlist(\'' + lsEsc + '\')' : 'showPage(\'setlists\')';
    var pctScopeLabel = _hasScope ? 'Setlist Readiness' : 'Band Readiness';
    var _slHelp = (typeof glInlineHelp !== 'undefined') ? glInlineHelp.renderHelpTrigger('setlist-readiness') : '';
    var pctBar = pct !== null ? '<div class="hd-hero__pct-row" onclick="'+pctClickAction+'" style="cursor:pointer" title="View setlist readiness">' +'<div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:var(--text-dim,#475569);text-transform:uppercase;margin-bottom:3px">'+pctScopeLabel+' '+_slHelp+'</div>' +'<div class="hd-hero__pct-val hd-score-pulse" style="color:'+pctColor+';font-size:32px;font-weight:900;line-height:1;letter-spacing:-0.02em;text-shadow:0 0 20px '+pctColor+'66;margin-bottom:6px">'+pct+'%</div>' +'<div class="hd-hero__pct-track"><div class="hd-hero__pct-fill" style="width:'+pct+'%;background:'+pctColor+';box-shadow:0 0 8px '+pctColor+'88"></div></div>' +'<div class="hd-hero__pct-state" style="color:'+pctColor+';font-size:11px;font-weight:700;margin-top:4px">'+rlLabel+'</div>' +'</div>' : '';
    var riskAvg = riskEntry ? _bandAvgForSong(riskEntry[1]) : null;
    var _riskSafeTitle = riskEntry ? riskEntry[0].replace(/'/g, "\\'") : '';
    var riskLine = riskEntry ? '<div class="hd-hero__risk-pill" style="cursor:pointer" onclick="showPage(\'songs\');setTimeout(function(){if(typeof GLStore!==\'undefined\')GLStore.selectSong(\'' + _riskSafeTitle + '\');},200)" title="Open practice mode for this song">⚠️ <span class="hd-hero__risk-song">Practice next: '+_escHtml(riskEntry[0])+'</span>'+(riskAvg!==null?'<span class="hd-hero__risk-avg" style="color:#ef4444">'+riskAvg.toFixed(1)+'</span>':'')+'</div>' : '';
    // Gig Confidence Meter — executive summary
    var _scTrend = null;
    var _pkDelta = 0;
    var _hasRecentRehearsal = false;
    var _rehearsalImproved = false;
    try {
        var _scD = (typeof GLStore !== 'undefined' && GLStore.getRehearsalScorecardData) ? GLStore.getRehearsalScorecardData() : null;
        if (_scD && _scD.latest) {
            var _tr = _scD.latest.trend || {};
            _scTrend = _tr.direction || null;
            var _ts = _scD.latest.createdAt || _scD.latest.completedAt;
            if (_ts && (Date.now() - new Date(_ts).getTime()) < 14 * 24 * 60 * 60 * 1000) _hasRecentRehearsal = true;
            // Check if rehearsal improved readiness
            var _rd = _scD.latest.readiness || {};
            if (_rd.hasEnoughData && _rd.deltaAvg > 0) _rehearsalImproved = true;
        }
        var _pkH = (typeof GLStore !== 'undefined' && GLStore.getRecentRehearsalPocketHistory) ? GLStore.getRecentRehearsalPocketHistory(3) : null;
        if (_pkH && _pkH.hasData && _pkH.entries[0] && _pkH.entries[0].deltaPocketPct != null) _pkDelta = _pkH.entries[0].deltaPocketPct;
    } catch(e3) {}
    var _gigConf = _computeGigConfidence({
        readinessPct: pct,
        riskCount: riskEntries.length,
        setlistSize: Object.keys(_gigSongScope).length || 1,
        hasRecentRehearsal: _hasRecentRehearsal,
        rehearsalImproved: _rehearsalImproved,
        scorecardTrend: _scTrend,
        pocketDelta: _pkDelta
    });
    var confHTML = _renderGigConfidence(_gigConf);
    // Simplified: one primary CTA based on state
    var _isReady = pct !== null && pct >= 85;
    var primaryCTA, secondaryCTA = '', tertiaryCTA = '';
    if (isToday) {
        primaryCTA = '<button class="hd-hero__cta hd-hero__cta--primary hd-hero__cta--golive" onclick="homeGoLive(\''+lsEsc+'\')">Run the Set \u2192</button>';
    } else if (_isReady) {
        primaryCTA = '<button class="hd-hero__cta hd-hero__cta--primary" onclick="homeGoLive(\''+lsEsc+'\')">Run the Set \u2192</button>';
        secondaryCTA = '<a onclick="showPage(\'rehearsal\')" style="font-size:0.72em;color:var(--accent-light);cursor:pointer;text-decoration:underline">Start rehearsal</a>';
    } else {
        primaryCTA = '<button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'rehearsal\')">Start Rehearsal \u2192</button>';
        secondaryCTA = '<a onclick="_hdOpenGig(\''+_escHtml((gig.venue||'').replace(/'/g,"\\'"))+'\')" style="font-size:0.72em;color:var(--text-dim);cursor:pointer">View gig details</a>';
    }
    if (ls) tertiaryCTA = '<a onclick="_hdViewSetlist(\''+lsEsc+'\')" style="font-size:0.72em;color:var(--text-dim);cursor:pointer">View setlist</a>';
    // ── Performance Coverage + Next Best Action (setlist-aware) ──
    // Availability check: who's blocked on gig day?
    var _unavailMembers = [];
    try {
        var _blocked = (typeof window._glCachedBlockedDates !== 'undefined') ? window._glCachedBlockedDates : [];
        var _gigDate = gig.date || '';
        if (_gigDate && _blocked.length) {
            _unavailMembers = _blocked.filter(function(b) { return b.startDate && b.endDate && _gigDate >= b.startDate && _gigDate <= b.endDate; });
        }
    } catch(e) {}

    // Coverage signal: combine availability + setlist + readiness
    var _availLine = '';
    if (_unavailMembers.length) {
        var _names = _unavailMembers.map(function(b) { return (b.person || '').split(' ')[0]; }).join(', ');
        // Count affected setlist songs (songs where unavailable member has a role/score)
        var _affectedCount = 0;
        if (_hasScope) {
            var _unavailKeys = [];
            _unavailMembers.forEach(function(b) {
                if (typeof bandMembers !== 'undefined') {
                    Object.entries(bandMembers).forEach(function(e) {
                        if (e[1].name === b.person) _unavailKeys.push(e[0]);
                    });
                }
            });
            Object.keys(_gigSongScope).forEach(function(st) {
                var _scores = rc2[st] || {};
                var affected = _unavailKeys.some(function(k) { return _scores[k] && _scores[k] > 0; });
                if (affected) _affectedCount++;
            });
        }
        var _coverageDetail = _affectedCount > 0
            ? _escHtml(_names) + ' unavailable — ' + _affectedCount + ' set song' + (_affectedCount !== 1 ? 's' : '') + ' affected'
            : _escHtml(_names) + ' unavailable';
        _availLine = '<div style="font-size:0.75em;padding:4px 10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;color:#f87171;margin:4px 0">⚠️ ' + _coverageDetail + '</div>';
    }

    // Next Best Action — setlist-aware priority hierarchy
    var agenda = (typeof GLStore !== 'undefined' && GLStore.generateRehearsalAgenda) ? GLStore.generateRehearsalAgenda() : null;
    var tl = (typeof GLStore !== 'undefined' && GLStore.getLatestTimeline) ? GLStore.getLatestTimeline() : null;
    var _nba = '';
    var _nbaLabel = '', _nbaOnclick = '', _nbaSecondary = '';
    if (_hasScope && riskEntry) {
        // Tier 1: weakest song in this gig's setlist
        _nbaLabel = 'Practice weakest setlist song: ' + riskEntry[0];
        _nbaOnclick = "showPage('songs');setTimeout(function(){if(typeof GLStore!=='undefined')GLStore.selectSong('" + _riskSafeTitle + "');},200)";
    } else if (_hasScope && !riskEntry) {
        // Strong setlist: all songs above threshold — no outside recommendations
        _nbaLabel = 'Setlist is strong — run the full set';
        _nbaSecondary = '';
        _nbaOnclick = '';
    } else if (ls && !_hasScope) {
        // Setlist linked but couldn't be resolved — safe fallback, don't use global pool
        _nbaLabel = 'Review setlist for ' + _escHtml(gig.venue || 'upcoming gig');
        _nbaOnclick = "showPage('setlists')";
    } else if (riskEntry) {
        // Tier 2/3: no setlist linked at all, use global weakest
        _nbaLabel = 'Practice weakest song: ' + riskEntry[0];
        _nbaOnclick = "showPage('songs');setTimeout(function(){if(typeof GLStore!=='undefined')GLStore.selectSong('" + _riskSafeTitle + "');},200)";
    } else if (!agenda || agenda.empty) {
        _nbaLabel = 'Plan next rehearsal';
        _nbaOnclick = "showPage('rehearsal');setTimeout(function(){if(typeof rhOpenCreateModal==='function')rhOpenCreateModal();},1200)";
    } else if (!tl || !tl.summary) {
        _nbaLabel = 'Upload rehearsal to improve readiness';
        _nbaOnclick = "if(typeof openRehearsalChopper==='function')openRehearsalChopper()";
    }
    if (_nbaLabel) {
        var _nbaColor = (_hasScope && !riskEntry) ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.08)';
        var _nbaBorder = (_hasScope && !riskEntry) ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)';
        var _nbaIcon = (_hasScope && !riskEntry) ? '✅' : '👉';
        _nba = '<div style="margin:8px 0;padding:10px 14px;background:' + _nbaColor + ';border:1px solid ' + _nbaBorder + ';border-radius:10px;display:flex;align-items:center;gap:10px">'
            + '<span style="font-size:1.1em">' + _nbaIcon + '</span>'
            + '<div style="flex:1">'
            + '<div style="font-size:0.92em;font-weight:700;color:var(--text)">' + _escHtml(_nbaLabel) + '</div>'
            + (_nbaSecondary ? '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">' + _escHtml(_nbaSecondary) + '</div>' : '')
            + '</div>'
            + (_nbaOnclick ? '<button onclick="' + _nbaOnclick + '" style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);color:#a5b4fc;padding:8px 16px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer;white-space:nowrap">Go →</button>' : '')
            + '</div>';
    }
    return ['<div class="hd-hero '+urgency+' home-anim-header">','<div class="hd-hero__eyebrow">BAND MISSION '+badge+'</div>','<div class="hd-hero__title-row"><span class="hd-hero__title">'+venue+'</span>'+rb+'</div>','<div class="hd-hero__sub">'+dateLbl+(timeLbl?' \xb7 '+timeLbl:'')+cdInline+'</div>',slLine,cd,confHTML,pctBar,riskLine,_availLine,_nba,coach?'<div class="hd-hero__coach">'+coach+'</div>':'','<div class="hd-hero__actions">'+primaryCTA+secondaryCTA+tertiaryCTA+'</div>','</div>'].join('');
  } catch(e) {
    console.warn('[Dashboard] Hero gig render error:', e.message);
    return '<div class="hd-hero home-anim-header"><div class="hd-hero__eyebrow">BAND MISSION</div><div class="hd-hero__title">' + _escHtml(gig.venue || 'Upcoming Gig') + '</div><div class="hd-hero__actions"><button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'gigs\')">Open Gigs \u2192</button></div></div>';
  }
}

function _renderHdHeroRehearsal(plan, bundle) {
    var today   = _todayStr();
    var isToday = plan.date === today;
    var diff    = plan.date ? _dayDiff(today, plan.date) : null;
    var dateLbl = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(plan.date);
    var time    = plan.time ? ' at ' + _escHtml(plan.time) : '';
    var loc     = plan.location ? _escHtml(plan.location) : 'Location TBD';
    var songs   = (plan.plan && Array.isArray(plan.plan.songs)) ? plan.plan.songs : [];
    var badge   = isToday ? '<span class="hd-hero__badge hd-hero__badge--rehearse">TONIGHT</span>' : '';
    return [
        '<div class="hd-hero hd-hero--rehearse' + (isToday ? ' hd-hero--urgent' : '') + ' home-anim-header">',
        '<div class="hd-hero__eyebrow">NEXT UP ' + badge + '</div>',
        '<div class="hd-hero__title">Rehearsal \u2014 ' + dateLbl + time + '</div>',
        '<div class="hd-hero__sub">' + loc + ' \xb7 ' + (songs.length ? songs.length + ' songs planned' : 'No songs planned yet') + '</div>',
        '<div class="hd-hero__actions"><button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button></div>',
        '</div>'
    ].join('');
}

function renderHdYourPrep(bundle) {
    var pf=deriveHdPrepFocus(bundle);
    if(!pf)return '<div class="hd-bucket hd-bucket--prep"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span></div><div class="hd-bucket__empty">Sign in to see your queue</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'practice\')">Song Library</button></div>';
    if(pf.empty)return '<div class="hd-bucket hd-bucket--prep hd-bucket--ok"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span></div><div class="hd-bucket__ok">All caught up \u2014 no songs below threshold</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'practice\')">Song Library</button></div>';
    var top=pf.top,rs=top.reasons.slice(0,2).join(' \xb7 ');
    var scoreColor=top.score<=1?'#ef4444':top.score<=2?'#f97316':'#fbbf24';
    var scoreChip='<span style="font-size:10px;font-weight:700;color:'+scoreColor+';background:'+scoreColor+'22;border-radius:4px;padding:1px 6px;margin-left:6px">'+top.score+'/5</span>';
    var mh=pf.total>1?'<div class="hd-bucket__more">+'+(pf.total-1)+' more need your attention</div>':'' ;
    var tl=pf.eventTie?'<div class="hd-bucket__event-tie" style="font-size:11px;color:var(--text-dim)">'+pf.eventTie+'</div>':'' ;
    return ['<div class="hd-bucket hd-bucket--prep">','<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span><span class="hd-bucket__count">'+pf.total+' song'+(pf.total!==1?'s':'')+'</span></div>','<div class="hd-bucket__focus-song" style="font-size:13px;font-weight:700;color:var(--text)">'+_escHtml(top.title)+scoreChip+'</div>','<div class="hd-bucket__reason-line" style="font-size:11px;color:var(--text-dim);margin-top:2px">'+rs+'</div>',tl,mh,'<button class="hd-bucket__cta hd-bucket__cta--primary" onclick="showPage(\'practice\')">Practice Now →</button>','</div>'].join('');
}

function renderHdBandStatus(bundle) {
    var intel=deriveHdBandIntel(bundle),rows=intel.map(function(l){var vs=l.color?' style="color:'+l.color+'"':'';var ic=l.icon?'<span style="margin-right:4px">'+l.icon+'</span>':'';return '<div class="hd-intel__row"><span class="hd-intel__label">'+ic+l.label+'</span><span class="hd-intel__value"'+vs+'>'+l.value+'</span></div>';}).join('');
    return ['<div class="hd-bucket hd-bucket--status">','<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83D\uDEA8</span><span class="hd-bucket__title">BAND STRATEGY</span></div>',rows?'<div class="hd-intel__rows">'+rows+'</div>':'<div class="hd-bucket__empty">No intel yet \u2014 add readiness scores to get started</div>','<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">View Band Status \u2192</button>','</div>'].join('');
}

function renderHdNextRehearsalGoal(bundle) {
    var plan = bundle.plans && bundle.plans[0];
    if (!plan) return '<div class="hd-bucket"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span><span class="hd-bucket__title">NEXT REHEARSAL GOAL</span></div><div class="hd-bucket__empty">No rehearsal scheduled \u2014 plan one to stay sharp</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">Plan Rehearsal \u2192</button></div>';
    var today = _todayStr();
    var diff = plan.date ? _dayDiff(today, plan.date) : null;
    var when = diff === 0 ? 'Tonight' : diff === 1 ? 'Tomorrow' : (plan.date ? _formatDateShort(plan.date) : 'Upcoming');
    var songs = (plan.plan && Array.isArray(plan.plan.songs)) ? plan.plan.songs : [];
    var rc = bundle.readinessCache || {};
    var targets = songs.filter(function(t){ var r=rc[t]; return r && _bandAvgForSong(r)<3; }).slice(0,3);
    if (!targets.length) targets = songs.slice(0,3);
    var songRows = targets.map(function(t){
        var avg = rc[t] ? _bandAvgForSong(rc[t]) : null;
        var chip = avg !== null ? '<span style="font-size:10px;color:'+(avg<2?'#ef4444':avg<3?'#f97316':'#fbbf24')+';font-weight:700;margin-left:4px">'+avg.toFixed(1)+'</span>' : '';
        var avgVal = rc[t] ? _bandAvgForSong(rc[t]) : null;
        var barPct = avgVal !== null ? Math.round((avgVal/5)*100) : 0;
        var barColor = avgVal < 2 ? '#ef4444' : avgVal < 3 ? '#f97316' : '#fbbf24';
        var miniBar = avgVal !== null ? '<div class="hd-bucket__mini-bar"><div class="hd-bucket__mini-fill" style="width:'+barPct+'%;background:'+barColor+'"></div></div>' : '';
        return '<div class="hd-bucket__song-row" style="flex-direction:column;align-items:stretch;gap:3px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="hd-bucket__song-title">'+_escHtml(t)+'</span>'+chip+'</div>'+miniBar+'</div>';
    }).join('');
    var more = songs.length > 3 ? '<div class="hd-bucket__more">+' + (songs.length-3) + ' more in plan</div>' : '';
    return ['<div class="hd-bucket">',
        '<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span><span class="hd-bucket__title">NEXT REHEARSAL GOAL</span></div>',
        '<div style="font-size:12px;color:var(--text);font-weight:700;margin-bottom:4px">'+when+(plan.location?' \xb7 '+_escHtml(plan.location):'')+'</div>',
        songs.length ? '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Focus songs:</div>' : '',
        songRows, more,
        '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
        '</div>'].join('');
}

function renderHdSongsNeedingWork(bundle) {
    var rc = bundle.readinessCache || {};
    var _hwSc = (typeof statusCache !== 'undefined') ? statusCache
        : (typeof GLStore !== 'undefined' && GLStore.getAllStatus) ? GLStore.getAllStatus() : {};
    var _hwActive = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
    var weak = Object.entries(rc).filter(function(e){
        var st = (_hwSc && _hwSc[e[0]]) || '';
        if (!_hwActive[st]) return false;
        var keys = Object.keys(e[1]||{}).filter(function(k){return typeof e[1][k]==='number'&&e[1][k]>0;});
        return keys.length && _bandAvgForSong(e[1]) < 3;
    }).sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);}).slice(0,4);
    if (!weak.length) return '<div class="hd-bucket hd-bucket--ok"><div class="hd-bucket__header"><span class="hd-bucket__icon">\u2705</span><span class="hd-bucket__title">SONGS NEEDING WORK</span></div><div class="hd-bucket__ok">All songs above readiness threshold \u2014 you\'re in good shape</div></div>';
    var rows = weak.map(function(e){
        var avg = _bandAvgForSong(e[1]);
        var color = avg < 2 ? '#ef4444' : avg < 2.5 ? '#f97316' : '#fbbf24';
        var urgLabel = avg < 2 ? '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--critical">CRITICAL</span>' : avg < 2.5 ? '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--warn">NEEDS WORK</span>' : '';
        return '<div class="hd-bucket__song-row" onclick="homeGoWeakSongs([\''+ e[0].replace(/'/g,"\\'") +'\'])" style="cursor:pointer">'+
            '<span class="hd-bucket__song-title">'+_escHtml(e[0])+' '+urgLabel+'</span>'+
            '<span style="font-size:11px;font-weight:700;color:'+color+'">'+avg.toFixed(1)+'/5</span>'+
            '</div>';
    }).join('');
    var total = Object.entries(rc).filter(function(e){ var st=(_hwSc&&_hwSc[e[0]])||''; if(!_hwActive[st])return false; var k=Object.keys(e[1]||{}).filter(function(k){return typeof e[1][k]==='number'&&e[1][k]>0;}); return k.length&&_bandAvgForSong(e[1])<3; }).length;
    var more = total > 4 ? '<div class="hd-bucket__more">+'+(total-4)+' more below threshold</div>' : '';
    return ['<div class="hd-bucket hd-bucket--weak">',
        '<div class="hd-bucket__header"><span class="hd-bucket__icon">\u26a0\ufe0f</span><span class="hd-bucket__title">SONGS NEEDING WORK</span><span class="hd-bucket__count">'+total+'</span></div>',
        '<div class="hd-bucket__list">'+rows+'</div>',
        more,
        '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'songs\')">View All Songs \u2192</button>',
        '</div>'].join('');
}

// ── Practice Radar (Milestone 5 Phase 3) ─────────────────────────────────────

var _prExpanded = false;

function renderPracticeRadar() {
    if (typeof GLStore === 'undefined' || !GLStore.getPracticeAttention) return '';
    var limit = _prExpanded ? 10 : 5;
    var items = GLStore.getPracticeAttention({ limit: limit });
    if (!items || !items.length) {
        return '<div class="hd-bucket" style="grid-column:1/-1">'
            + '<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span>'
            + '<span class="hd-bucket__title">PRACTICE RADAR</span></div>'
            + '<div class="hd-bucket__ok">No practice data yet \u2014 add readiness scores to get started</div>'
            + '</div>';
    }

    var rows = items.map(function(item, i) {
        var urgency = _prUrgencyTier(item);
        var safeTitle = item.songId.replace(/'/g, "\\'");
        var confLabel = item.confidence !== 'rated'
            ? '<span style="font-size:0.65em;color:var(--text-dim,#475569);margin-left:6px;font-weight:600">'
              + (item.confidence === 'partial' ? 'partial' : 'needs rating') + '</span>'
            : '';
        return '<div class="hd-bucket__song-row" onclick="showPage(\'songs\');setTimeout(function(){GLStore.selectSong(\'' + safeTitle + '\');if(typeof highlightSelectedSongRow===\'function\')highlightSelectedSongRow(\'' + safeTitle + '\');},200)" style="cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:8px">'
            + '<span style="font-size:0.72em;font-weight:800;color:var(--text-dim,#475569);width:18px;text-align:center;flex-shrink:0">' + (i + 1) + '</span>'
            + '<div style="min-width:0;flex:1">'
            + '<div class="hd-bucket__song-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(item.songId) + '</div>'
            + '<div style="font-size:0.7em;color:var(--text-dim,#475569);margin-top:1px">' + _escHtml(item.topReason) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
            + urgency.badge
            + confLabel
            + '<span style="font-size:0.78em;font-weight:700;color:' + urgency.color + ';min-width:32px;text-align:right">' + item.score + '</span>'
            + '</div>'
            + '</div>';
    }).join('');

    var expandBtn = '';
    if (!_prExpanded) {
        expandBtn = '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="_prExpanded=true;if(typeof renderHomeDashboard===\'function\')renderHomeDashboard()">View More \u2192</button>';
    } else {
        expandBtn = '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="_prExpanded=false;if(typeof renderHomeDashboard===\'function\')renderHomeDashboard()">Show Less</button>';
    }

    return '<div class="hd-bucket">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">\uD83C\uDFAF</span>'
        + '<span class="hd-bucket__title">PRACTICE RADAR</span>'
        + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('practice-radar') : '')
        + '<span class="hd-bucket__count">' + items.length + '</span>'
        + '</div>'
        + '<div class="hd-bucket__list">' + rows + '</div>'
        + expandBtn
        + '</div>';
}

/**
 * Map a Practice Attention item to an urgency tier.
 * @returns {{ label, badge, color }}
 */
function _prUrgencyTier(item) {
    if (item.score >= 20) return {
        label: 'Needs Work',
        badge: '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--critical">NEEDS WORK</span>',
        color: '#ef4444'
    };
    if (item.score >= 12) return {
        label: 'Attention',
        badge: '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--warn">ATTENTION</span>',
        color: '#f59e0b'
    };
    return {
        label: 'Keep Warm',
        badge: '',
        color: '#22c55e'
    };
}

/**
 * Convert a Practice Attention item's raw reasons into a human-readable sentence.
 * Uses breakdown data + reasons array from computePracticeAttention().
 */
function _humanizePracticeReason(pr) {
    if (!pr) return '';
    var bd = pr.breakdown || {};
    var parts = [];

    // Pick the most meaningful signal, in priority order
    if (bd.exposureBoost >= 8) {
        parts.push('On the setlist for your next gig');
    }
    if (bd.statusModifier >= 4) {
        parts.push('Marked gig-ready but band avg is only ' + (pr.avg || '?') + '/5');
    }
    if (bd.decayRisk >= 6) {
        // Find the days-since text from reasons
        var decayReason = (pr.reasons || []).find(function(r) { return r.indexOf('days since') >= 0 || r.indexOf('Never practiced') >= 0; });
        parts.push(decayReason || 'Not practiced recently');
    }
    if (bd.readinessDeficit >= 6) {
        parts.push('Band avg ' + (pr.avg || '?') + '/5 \u2014 needs work');
    }
    if (bd.variancePenalty >= 2) {
        parts.push('Some members rated much lower than others');
    }
    if (bd.unratedNudge > 0 && parts.length === 0) {
        parts.push('Not all members have rated this song');
    }

    if (!parts.length) {
        // Fallback to the engine's top reason
        return pr.topReason || '';
    }
    // Return first two reasons joined
    return parts.slice(0, 2).join(' \xb7 ');
}

// ── Rehearsal Agenda (Milestone 6 Phase 1) ───────────────────────────────────

function renderRehearsalAgenda() {
    if (typeof GLStore === 'undefined' || !GLStore.generateRehearsalAgenda) return '';
    var agenda = GLStore.generateRehearsalAgenda();
    if (!agenda) return '';

    if (agenda.empty) {
        return '<div class="hd-bucket" style="grid-column:1/-1">'
            + '<div class="hd-bucket__header"><span class="hd-bucket__icon">📋</span>'
            + '<span class="hd-bucket__title">SUGGESTED REHEARSAL AGENDA</span></div>'
            + '<div class="hd-bucket__ok">' + _escHtml(agenda.emptyReason) + '</div>'
            + '</div>';
    }

    var typeColors = {
        warmup:  '#22c55e',
        repair:  '#f59e0b',
        learn:   '#818cf8',
        closer:  '#60a5fa',
    };
    var typeIcons = {
        warmup:  '🔥',
        repair:  '🔧',
        learn:   '📖',
        closer:  '🎯',
    };

    // Check for active session to show resume
    var activeSession = (typeof GLStore !== 'undefined' && GLStore.getActiveRehearsalAgendaSession)
        ? GLStore.getActiveRehearsalAgendaSession() : null;
    var hasActiveSession = activeSession && activeSession.status === 'active';

    var rows = agenda.items.map(function(item, idx) {
        var color = typeColors[item.type] || '#94a3b8';
        var icon = typeIcons[item.type] || '🎵';
        var safeTitle = item.songId.replace(/'/g, "\\'");
        var meta = item.metadata;
        var readinessChip = meta.avgReadiness > 0
            ? '<span style="font-size:0.68em;font-weight:700;color:' + color + '">' + meta.avgReadiness + '/5</span>'
            : '<span style="font-size:0.68em;color:var(--text-dim,#475569)">unrated</span>';

        return '<div onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaAtIndex(' + idx + ')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
            + '<div style="display:flex;align-items:center;gap:8px">'
            + '<div style="width:36px;height:36px;border-radius:8px;background:' + color + '15;border:1px solid ' + color + '33;display:flex;align-items:center;justify-content:center;font-size:1em;flex-shrink:0">' + icon + '</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">'
            + '<span style="font-weight:700;font-size:0.88em;color:var(--text,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(item.title) + '</span>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
            + readinessChip
            + '<span style="font-size:0.65em;font-weight:700;color:' + color + ';background:' + color + '18;padding:1px 6px;border-radius:4px;text-transform:uppercase">' + item.minutes + 'min</span>'
            + '</div></div>'
            + '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin-top:1px">' + _escHtml(item.reason) + '</div>'
            + '<div style="font-size:0.7em;color:#818cf8;font-weight:600;margin-top:2px">🔥 Focus: ' + _escHtml(item.focus) + '</div>'
            + '</div></div></div>';
    }).join('');

    return '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">📋</span>'
        + '<span class="hd-bucket__title">SUGGESTED REHEARSAL AGENDA</span>'
        + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('how-it-works') : '')
        + '<span style="font-size:0.72em;font-weight:700;color:var(--text-dim,#475569)">' + agenda.totalMinutes + ' min</span>'
        + '</div>'
        + (agenda.summary ? '<div style="font-size:0.78em;color:var(--text-muted,#94a3b8);margin-bottom:4px;padding:0 2px">' + _escHtml(agenda.summary) + '</div>' : '')
        + (agenda.recordingInformed ? '<div style="font-size:0.68em;color:#818cf8;margin-bottom:8px;padding:0 2px;display:flex;align-items:center;gap:4px"><span style="font-size:0.9em">🎙️</span>' + _escHtml(agenda.sessionLabel || 'Informed by your latest rehearsal recording.') + '</div>' : '')
        + '<div>' + rows + '</div>'
        + (agenda.isSameAsPrevious ? '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin:8px 0 2px;text-align:center">Best agenda for current data — no stronger alternates available.</div>' : '')
        + (hasActiveSession
            ? '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.25);border-radius:10px;padding:8px 12px;margin:8px 0;display:flex;align-items:center;justify-content:space-between">'
              + '<span style="font-size:0.78em;color:#818cf8;font-weight:700">Session in progress — slot ' + (activeSession.currentIndex + 1) + ' of ' + activeSession.items.length + '</span>'
              + '<button onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaAtIndex(' + activeSession.currentIndex + ')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:5px 12px;font-size:0.75em;font-weight:700;cursor:pointer">Resume</button>'
              + '</div>'
            : '')
        + '<div style="display:flex;gap:8px;margin-top:10px">'
        + '<button onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaSession()" style="flex:1;padding:10px 16px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:800;font-size:0.88em;cursor:pointer;box-shadow:0 2px 12px rgba(102,126,234,0.3)">🎸 Start Rehearsal</button>'
        + '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="if(typeof GLStore!==\'undefined\'){GLStore.regenerateRehearsalAgenda();if(typeof renderHomeDashboard===\'function\')renderHomeDashboard();}">🔄</button>'
        + '</div>'
        + '</div>';
}

// ── Rehearsal Insights Card ───────────────────────────────────────────────────

function renderRehearsalInsights() {
    var tl = (typeof GLStore !== 'undefined' && GLStore.getLatestTimeline) ? GLStore.getLatestTimeline() : null;

    if (!tl || !tl.summary) {
        return '<div class="hd-bucket">'
            + '<div class="hd-bucket__header"><span class="hd-bucket__icon">🔬</span><span class="hd-bucket__title">REHEARSAL INSIGHTS</span></div>'
            + '<div class="hd-bucket__empty">No rehearsal recordings analyzed yet. Upload one to unlock rehearsal insights.</div>'
            + '</div>';
    }

    var sm = tl.summary;
    var h = '<div class="hd-bucket">'
        + '<div class="hd-bucket__header"><span class="hd-bucket__icon">🔬</span><span class="hd-bucket__title">REHEARSAL INSIGHTS</span></div>';

    // Last Recording stats
    h += '<div style="margin-bottom:8px">';
    h += '<div style="font-size:0.65em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px">Last Recording</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<span style="font-size:0.72em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(99,102,241,0.12);color:#818cf8">' + sm.segmentCount + ' segments</span>';
    if (sm.musicSegments) h += '<span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.1);color:#86efac">' + sm.musicSegments + ' music</span>';
    if (sm.likelyRestarts) h += '<span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(251,191,36,0.1);color:#fbbf24">' + sm.likelyRestarts + ' restart' + (sm.likelyRestarts > 1 ? 's' : '') + '</span>';
    if (sm.speechSegments) h += '<span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-dim)">' + sm.speechSegments + ' discussion</span>';
    h += '</div></div>';

    // Most restarted / best run — derive from segments if available
    if (tl.segments && tl.segments.length) {
        var songAttempts = {};
        var songRestarts = {};
        for (var i = 0; i < tl.segments.length; i++) {
            var seg = tl.segments[i];
            var title = seg.likelySongTitle;
            if (!title) continue;
            if (seg.likelyIntent === 'restart') {
                songRestarts[title] = (songRestarts[title] || 0) + 1;
            } else if (seg.kind === 'music' && seg.likelyIntent === 'attempt') {
                songAttempts[title] = (songAttempts[title] || 0) + 1;
            }
        }

        // Most restarted
        var topRestart = null, topRestartCount = 0;
        for (var r in songRestarts) {
            if (songRestarts[r] > topRestartCount) { topRestart = r; topRestartCount = songRestarts[r]; }
        }

        // Best run = song with attempts and no restarts (or fewest)
        var bestRun = null;
        for (var a in songAttempts) {
            if (!songRestarts[a]) { bestRun = a; break; }
        }

        if (topRestart || bestRun) {
            h += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
            if (topRestart) {
                h += '<div style="flex:1;min-width:100px"><div style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:2px">Most Restarted</div>'
                    + '<div style="font-size:0.82em;font-weight:700;color:#fbbf24">' + _escHtml(topRestart) + '</div></div>';
            }
            if (bestRun) {
                h += '<div style="flex:1;min-width:100px"><div style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:2px">Best Run</div>'
                    + '<div style="font-size:0.82em;font-weight:700;color:#86efac">' + _escHtml(bestRun) + '</div></div>';
            }
            h += '</div>';
        }
    }

    // Pocket Time meter
    var pt = (typeof GLStore !== 'undefined' && GLStore.getPocketTimeMetrics) ? GLStore.getPocketTimeMetrics() : null;
    if (pt) {
        var ptColor = pt.pocketTimePct >= 70 ? '#22c55e' : pt.pocketTimePct >= 50 ? '#60a5fa' : pt.pocketTimePct >= 30 ? '#f59e0b' : '#ef4444';
        h += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">';
        h += '<div style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:6px">Pocket Time</div>';
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        h += '<div style="flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">';
        h += '<div style="height:100%;width:' + pt.pocketTimePct + '%;background:' + ptColor + ';border-radius:4px;transition:width 0.4s"></div>';
        h += '</div>';
        h += '<span style="font-size:0.88em;font-weight:800;color:' + ptColor + ';min-width:36px;text-align:right">' + pt.pocketTimePct + '%</span>';
        h += '</div>';
        h += '<div style="font-size:0.75em;font-weight:700;color:' + ptColor + ';margin-bottom:4px">' + pt.label + '</div>';
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
        h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);color:var(--text-dim)">Longest: ' + pt.longestRunMinutes + 'min</span>';
        h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);color:var(--text-dim)">' + pt.restartCount + ' restart' + (pt.restartCount !== 1 ? 's' : '') + '</span>';
        h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.04);color:var(--text-dim)">Avg run: ' + pt.averageRunLengthSeconds + 's</span>';
        h += '</div>';

        // Pocket Time trend
        var pth = (typeof GLStore !== 'undefined' && GLStore.getRecentRehearsalPocketHistory) ? GLStore.getRecentRehearsalPocketHistory(5) : null;
        if (pth && pth.hasData && pth.count >= 2) {
            h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">';
            // Simple bar sequence
            h += '<div style="display:flex;align-items:flex-end;gap:3px;height:32px;margin-bottom:4px">';
            var maxPct = 0;
            for (var bi = 0; bi < pth.entries.length; bi++) { if (pth.entries[bi].pocketTimePct > maxPct) maxPct = pth.entries[bi].pocketTimePct; }
            maxPct = Math.max(maxPct, 10);
            for (var bj = pth.entries.length - 1; bj >= 0; bj--) { // oldest to newest, left to right
                var be = pth.entries[bj];
                var barH = Math.max(4, Math.round((be.pocketTimePct / maxPct) * 28));
                var barColor = be.pocketTimePct >= 70 ? '#22c55e' : be.pocketTimePct >= 50 ? '#60a5fa' : be.pocketTimePct >= 30 ? '#f59e0b' : '#ef4444';
                var isNewest = bj === 0;
                h += '<div title="' + be.pocketTimePct + '% · ' + (be.createdAt || '').slice(0, 10) + '" style="flex:1;height:' + barH + 'px;background:' + barColor + ';border-radius:3px;opacity:' + (isNewest ? '1' : '0.5') + '"></div>';
            }
            h += '</div>';
            // Delta + insight
            var latest = pth.entries[0];
            if (latest.deltaPocketPct !== null) {
                var dColor = latest.deltaPocketPct > 0 ? '#22c55e' : latest.deltaPocketPct < 0 ? '#ef4444' : '#94a3b8';
                var dSign = latest.deltaPocketPct > 0 ? '+' : '';
                h += '<span style="font-size:0.68em;font-weight:700;color:' + dColor + '">' + dSign + latest.deltaPocketPct + ' pts</span> ';
            }
            if (pth.insight) {
                h += '<div style="font-size:0.68em;color:var(--text-dim,#475569);margin-top:2px">' + _escHtml(pth.insight) + '</div>';
            }
            h += '</div>';
        }

        h += '</div>';
    }

    h += '</div>';
    return h;
}

// ── Rehearsal Timeline Preview ────────────────────────────────────────────────

function renderRehearsalTimelinePreview() {
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalIntelligence) return '';
    var ri = GLStore.getRehearsalIntelligence();
    if (!ri || !ri.hasData) return '';

    var h = '<div class="hd-bucket" style="grid-column:1/-1">';
    h += '<div class="hd-bucket__header">';
    h += '<span class="hd-bucket__icon">📊</span>';
    h += '<span class="hd-bucket__title">REHEARSAL TIMELINE</span>';
    h += '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim,#475569)">' + ri.totalDurationMin + ' min</span>';
    h += '</div>';

    // Compact horizontal segmented strip
    var kindColors = { music: '#667eea', speech: '#f59e0b', silence: '#334155', unknown: '#1e293b', excluded: '#1e293b' };
    var intentMarkers = { restart: '#ef4444' };
    h += '<div style="position:relative;height:28px;background:#0f172a;border-radius:6px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(255,255,255,0.06)">';
    for (var i = 0; i < ri.stripSegments.length; i++) {
        var seg = ri.stripSegments[i];
        var color = kindColors[seg.kind] || '#1e293b';
        var opacity = seg.kind === 'silence' ? '0.3' : '0.8';
        h += '<div title="' + _escHtml((seg.title || seg.kind) + ' · ' + Math.round(seg.durationSec) + 's') + '" style="position:absolute;left:' + seg.startPct.toFixed(2) + '%;width:' + Math.max(seg.widthPct, 0.3).toFixed(2) + '%;height:100%;background:' + color + ';opacity:' + opacity + '"></div>';
        // Restart marker
        if (seg.intent === 'restart') {
            h += '<div style="position:absolute;left:' + seg.startPct.toFixed(2) + '%;top:0;width:2px;height:100%;background:#ef4444;opacity:0.9" title="Restart detected"></div>';
        }
    }
    // Best run highlight
    if (ri.bestRun && ri.totalDurationSec > 0) {
        // Find the matching strip segment for a subtle highlight
        for (var br = 0; br < ri.stripSegments.length; br++) {
            var brs = ri.stripSegments[br];
            if (brs.title === ri.bestRun.title && Math.abs(brs.durationSec - ri.bestRun.durationSec) < 2) {
                h += '<div style="position:absolute;left:' + brs.startPct.toFixed(2) + '%;width:' + brs.widthPct.toFixed(2) + '%;bottom:0;height:3px;background:#22c55e;border-radius:0 0 2px 2px" title="Best run: ' + _escHtml(ri.bestRun.title) + '"></div>';
                break;
            }
        }
    }
    h += '</div>';

    // Legend
    h += '<div style="display:flex;gap:10px;margin-bottom:8px;flex-wrap:wrap">';
    h += '<span style="font-size:0.62em;color:var(--text-dim);display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:#667eea;display:inline-block"></span>Music</span>';
    h += '<span style="font-size:0.62em;color:var(--text-dim);display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:#f59e0b;display:inline-block"></span>Speech</span>';
    h += '<span style="font-size:0.62em;color:var(--text-dim);display:flex;align-items:center;gap:3px"><span style="width:8px;height:2px;background:#ef4444;display:inline-block"></span>Restart</span>';
    if (ri.bestRun) h += '<span style="font-size:0.62em;color:var(--text-dim);display:flex;align-items:center;gap:3px"><span style="width:8px;height:3px;background:#22c55e;border-radius:1px;display:inline-block"></span>Best run</span>';
    h += '</div>';

    // Takeaways
    if (ri.takeaways && ri.takeaways.length) {
        h += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:6px">';
        for (var t = 0; t < ri.takeaways.length; t++) {
            h += '<div style="font-size:0.75em;color:var(--text-muted,#94a3b8);padding:1px 0">→ ' + _escHtml(ri.takeaways[t]) + '</div>';
        }
        h += '</div>';
    }

    // Metadata completeness
    if (ri.metadataCompleteness < 50 && ri.musicSegments > 0) {
        h += '<div style="font-size:0.68em;color:var(--text-dim,#475569);margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.04)">';
        h += '💡 Name more segments in the Chopper for richer insights (' + ri.metadataCompleteness + '% labeled).';
        h += '</div>';
    }

    h += '</div>';
    return h;
}

// ── Next Best Step Banner ─────────────────────────────────────────────────────

function _renderNextStepBanner(wf) {
    if (!wf || !wf.nextActionLabel) return '';

    var targetActions = {
        agenda: "if(typeof GLStore!=='undefined'&&GLStore.regenerateRehearsalAgenda){GLStore.regenerateRehearsalAgenda();if(typeof renderHomeDashboard==='function')renderHomeDashboard();}",
        chopper: "if(typeof openRehearsalChopper==='function')openRehearsalChopper()",
        learn: "var el=document.querySelector('[data-phase=\"Learn\"]');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})",
        improve: "var el=document.querySelector('[data-phase=\"Improve\"]');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})",
    };
    var onclick = targetActions[wf.nextActionTarget] || '';

    return '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03));border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px">'
        + '<div style="font-size:1.4em;flex-shrink:0">🎯</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-weight:700;font-size:0.88em;color:var(--text,#f1f5f9)">' + wf.nextActionLabel + '</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-top:2px">' + (wf.nextActionDescription || '') + '</div>'
        + '</div>'
        + (onclick ? '<button onclick="' + onclick + '" style="padding:7px 14px;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:700;font-size:0.78em;cursor:pointer;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 8px rgba(99,102,241,0.3)">Go →</button>' : '')
        + '</div>';
}

// ── Attempt Intelligence Card ─────────────────────────────────────────────────

function renderAttemptIntelligence() {
    if (typeof GLStore === 'undefined' || !GLStore.getAttemptIntelligence) return '';
    var ai = GLStore.getAttemptIntelligence();
    if (!ai || !ai.hasData) return '';

    var h = '<div class="hd-bucket" style="grid-column:1/-1">';
    h += '<div class="hd-bucket__header">';
    h += '<span class="hd-bucket__icon">🎯</span>';
    h += '<span class="hd-bucket__title">SONG ATTEMPTS</span>';
    h += '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim,#475569)">' + ai.songs.length + ' songs</span>';
    h += '</div>';

    // Top songs (max 5)
    var show = ai.songs.slice(0, 5);
    for (var i = 0; i < show.length; i++) {
        var song = show[i];
        var hasRestart = song.restartCount > 0;
        var hasBest = !!song.bestRun;
        var safeTitle = _escHtml(song.title);
        var drilldownId = 'att-drill-' + i;

        h += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
        // Title row — clickable for drilldown
        h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;cursor:pointer" onclick="_hdToggleAttemptDrilldown(\'' + drilldownId + '\',' + i + ')">';
        h += '<span style="font-weight:700;font-size:0.85em;color:var(--text,#f1f5f9)">' + safeTitle + ' <span style="font-size:0.7em;color:var(--text-dim)">▸</span></span>';
        h += '<div style="display:flex;gap:4px">';
        h += '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(99,102,241,0.12);color:#818cf8">' + song.attemptCount + ' attempt' + (song.attemptCount > 1 ? 's' : '') + '</span>';
        if (hasRestart) h += '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(239,68,68,0.12);color:#f87171">' + song.restartCount + ' restart' + (song.restartCount > 1 ? 's' : '') + '</span>';
        h += '</div></div>';

        // Attempt strip
        h += '<div style="display:flex;gap:2px;align-items:flex-end;height:20px">';
        var maxDur = 0;
        for (var m = 0; m < song.attempts.length; m++) { if (song.attempts[m].durationSec > maxDur) maxDur = song.attempts[m].durationSec; }
        maxDur = Math.max(maxDur, 10);
        for (var a = 0; a < song.attempts.length; a++) {
            var att = song.attempts[a];
            var barH = Math.max(4, Math.round((att.durationSec / maxDur) * 18));
            var barColor = att.isBestRun ? '#22c55e' : att.endedInRestart ? '#ef4444' : '#667eea';
            var barBorder = att.hadUserRestartMarker ? '1px solid rgba(239,68,68,0.5)' : 'none';
            var attLabel = att.isBestRun ? 'best run' : att.endedInRestart ? 'restart' : 'attempt';
            h += '<div title="' + Math.round(att.durationSec) + 's' + (att.endedInRestart ? ' (restart)' : '') + (att.isBestRun ? ' ★ best' : '') + '" onclick="event.stopPropagation();_hdJumpToAttempt(' + att.startSec + ',' + att.endSec + ',\'' + attLabel + '\')" style="flex:1;height:' + barH + 'px;background:' + barColor + ';border-radius:2px;border:' + barBorder + ';opacity:' + (att.isBestRun ? '1' : '0.7') + ';cursor:pointer"></div>';
        }
        h += '</div>';

        // Stats row
        h += '<div style="display:flex;gap:6px;margin-top:3px">';
        h += '<span style="font-size:0.62em;color:var(--text-dim,#475569)">' + song.totalWorkMin + 'min total</span>';
        if (hasBest) h += '<span style="font-size:0.62em;color:#22c55e">Best: ' + Math.round(song.bestRun.durationSec) + 's</span>';
        if (song.lowConfidence) h += '<span style="font-size:0.62em;color:#f87171">⚠ needs work</span>';
        if (song.improving) h += '<span style="font-size:0.62em;color:#22c55e">↑ improving</span>';
        h += '</div>';

        // Drilldown panel (hidden by default)
        h += '<div id="' + drilldownId + '" style="display:none"></div>';

        h += '</div>';
    }

    if (ai.songs.length > 5) {
        h += '<div style="font-size:0.68em;color:var(--text-dim,#475569);padding:4px 0;text-align:center">+' + (ai.songs.length - 5) + ' more song' + (ai.songs.length - 5 > 1 ? 's' : '') + '</div>';
    }

    h += '</div>';
    return h;
}

// ── Attempt Drilldown ─────────────────────────────────────────────────────────

window._hdToggleAttemptDrilldown = function(panelId, songIdx) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    if (panel.style.display !== 'none' && panel.innerHTML) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }
    // Get attempt data
    if (typeof GLStore === 'undefined' || !GLStore.getAttemptIntelligence) return;
    var ai = GLStore.getAttemptIntelligence();
    if (!ai || !ai.hasData || songIdx >= ai.songs.length) return;
    var song = ai.songs[songIdx];

    var h = '<div style="margin-top:8px;padding:10px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.15);border-radius:8px">';

    // Header
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    h += '<div style="font-weight:800;font-size:0.88em;color:var(--text)">' + _escHtml(song.title) + '</div>';
    h += '<button onclick="document.getElementById(\'' + panelId + '\').style.display=\'none\';document.getElementById(\'' + panelId + '\').innerHTML=\'\'" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em">✕</button>';
    h += '</div>';

    // Summary pills
    h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">';
    h += '<span style="font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(99,102,241,0.12);color:#818cf8">' + song.attemptCount + ' attempts</span>';
    h += '<span style="font-size:0.68em;font-weight:600;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.04);color:var(--text-dim)">' + song.totalWorkMin + ' min</span>';
    if (song.restartCount) h += '<span style="font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,0.1);color:#f87171">' + song.restartCount + ' restarts</span>';
    if (song.bestRun) h += '<span style="font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac">Best: ' + Math.round(song.bestRun.durationSec) + 's</span>';
    if (song.lowConfidence) h += '<span style="font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(239,68,68,0.1);color:#f87171">⚠ low confidence</span>';
    if (song.improving) h += '<span style="font-size:0.68em;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac">↑ improving</span>';
    h += '</div>';

    // Practice focus summary
    h += '<div style="font-size:0.75em;color:var(--text-muted,#94a3b8);margin-bottom:8px">';
    h += _hdAttemptSummaryText(song);
    h += '</div>';

    // Attempt list
    h += '<div style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px">Attempts</div>';
    for (var a = 0; a < song.attempts.length; a++) {
        var att = song.attempts[a];
        var aColor = att.isBestRun ? '#22c55e' : att.endedInRestart ? '#ef4444' : '#667eea';
        var aIcon = att.isBestRun ? '★' : att.endedInRestart ? '✕' : '▸';
        var aLabel = att.isBestRun ? 'best run' : att.endedInRestart ? 'restart' : 'attempt';
        h += '<div onclick="_hdJumpToAttempt(' + att.startSec + ',' + att.endSec + ',\'' + aLabel + '\')" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03)">';
        h += '<span style="color:' + aColor + ';font-size:0.9em;width:14px;text-align:center">' + aIcon + '</span>';
        h += '<span style="font-size:0.8em;font-weight:600;color:var(--text-muted)">#' + (a + 1) + '</span>';
        h += '<span style="font-size:0.78em;color:var(--text);flex:1">' + Math.round(att.durationSec) + 's</span>';
        h += '<span style="font-size:0.68em;color:' + aColor + ';font-weight:600">' + aLabel + '</span>';
        if (att.hadUserRestartMarker) h += '<span style="font-size:0.65em;color:var(--text-dim)" title="User-confirmed restart">📌</span>';
        h += '</div>';
    }

    h += '</div>';
    panel.innerHTML = h;
    panel.style.display = 'block';
};

function _hdAttemptSummaryText(song) {
    if (song.lowConfidence) {
        return 'Most attempts ended in restarts. Focus on getting through the full structure before polishing.';
    }
    if (song.improving && song.bestRun) {
        return 'One strong ' + Math.round(song.bestRun.durationSec) + 's clean run suggests this song is improving. A few more full passes will lock it in.';
    }
    if (song.restartEndedCount >= 2 && song.attemptCount >= 3) {
        return 'Work concentrated in short repeated attempts. Try running the full song from top to build continuity.';
    }
    if (song.attemptCount === 1) {
        return 'Single attempt recorded. More data will help assess progress.';
    }
    return song.attemptCount + ' attempts logged. ' + (song.bestRun ? 'Best run at ' + Math.round(song.bestRun.durationSec) + 's.' : 'No clean run yet.');
}

// ── Attempt Deep Link Helper ──────────────────────────────────────────────────

window._hdJumpToAttempt = function(startSec, endSec, label) {
    var chopperAlreadyOpen = !!document.getElementById('rehearsalChopperModal');
    if (!chopperAlreadyOpen && typeof openRehearsalChopper === 'function') {
        openRehearsalChopper();
    }
    var delay = chopperAlreadyOpen ? 50 : 600; // less delay if already open
    setTimeout(function() {
        var audio = document.getElementById('chopAudio');
        if (audio) { audio.currentTime = startSec; audio.play(); }
        if (typeof chopSetZoom === 'function') chopSetZoom(Math.max(0, startSec - 5), endSec + 10);
        // Brief region highlight
        if (typeof chopRegion !== 'undefined') {
            window.chopRegion = { startSec: startSec, endSec: endSec };
            if (typeof chopUpdateRegionHighlight === 'function') chopUpdateRegionHighlight();
            setTimeout(function() { window.chopRegion = null; if (typeof chopUpdateRegionHighlight === 'function') chopUpdateRegionHighlight(); }, 3000);
        }
        if (typeof showToast === 'function') {
            var dur = Math.round(endSec - startSec);
            showToast('🎯 Jumped to ' + label + ' · ' + dur + 's at ' + (typeof formatChopTime === 'function' ? formatChopTime(startSec) : Math.round(startSec) + 's'));
        }
    }, delay);
};

// ── Upload Rehearsal CTA ──────────────────────────────────────────────────────

function renderUploadRehearsal() {
    return '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div style="display:flex;align-items:center;gap:12px;padding:4px 0">'
        + '<div style="font-size:1.6em;flex-shrink:0">🎙️</div>'
        + '<div style="flex:1">'
        + '<div style="font-weight:700;font-size:0.9em;color:var(--text,#f1f5f9)">Analyze Rehearsal Recording</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-top:2px">Drop in a rehearsal recording to auto-segment takes, tag restarts, and feed scorecards.</div>'
        + '</div>'
        + '<button onclick="if(typeof openRehearsalChopper===\'function\')openRehearsalChopper()" style="padding:8px 16px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;font-weight:700;font-size:0.82em;cursor:pointer;white-space:nowrap;box-shadow:0 2px 8px rgba(245,158,11,0.3)">✂️ Upload & Chop</button>'
        + '</div>'
        + '</div>';
}

// ── Last Rehearsal Card (Milestone 6 Phase 4B) ───────────────────────────────

function renderLastRehearsal() {
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalScorecardData) return '';
    var data = GLStore.getRehearsalScorecardData();
    if (!data) return '';
    var s = data.latest;
    var t = data.trend;
    var ti = s.trendInputs || s; // support canonical and legacy

    // Friendly recency
    var recency = '';
    var tsField = s.createdAt || s.completedAt;
    if (tsField) {
        var ms = Date.now() - new Date(tsField).getTime();
        var mins = Math.round(ms / 60000);
        if (mins < 2) recency = 'Just now';
        else if (mins < 60) recency = mins + ' min ago';
        else if (mins < 1440) recency = Math.round(mins / 60) + 'h ago';
        else recency = Math.round(mins / 1440) + 'd ago';
    }

    var scoreColor = s.score >= 80 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444';

    var h = '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">🏁</span>'
        + '<span class="hd-bucket__title">REHEARSAL SCORECARD</span>'
        + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('scorecard-score') : '')
        + (recency ? '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim,#475569)">' + recency + '</span>' : '')
        + '</div>'
        + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderNextStepBanner('after-scorecard', 'glHelp_afterScore') : '');

    // Score + label + headline
    h += '<div style="display:flex;align-items:center;gap:16px;padding:4px 0">'
        + '<div style="text-align:center;min-width:50px">'
        + '<div style="font-size:1.8em;font-weight:900;color:' + scoreColor + '">' + s.score + '</div>'
        + (s.label ? '<div style="font-size:0.58em;font-weight:700;color:' + scoreColor + ';text-transform:uppercase;letter-spacing:0.06em">' + _escHtml(s.label) + '</div>' : '')
        + '</div>'
        + '<div style="flex:1">'
        + (s.headline ? '<div style="font-size:0.82em;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:4px">' + _escHtml(s.headline) + '</div>' : '')
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.12);color:#86efac">'
        + (ti.completedCount || 0) + ' done · ' + (ti.completedMinutes || 0) + 'min</span>'
        + ((ti.skippedCount || 0) > 0 ? '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(251,191,36,0.12);color:#fbbf24">'
        + ti.skippedCount + ' skipped</span>' : '')
        + '<span style="font-size:0.7em;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-dim,#475569)">'
        + (s.completionRate || 0) + '%</span>'
        + ((s.elapsedMinutes || 0) >= 3 ? '<span style="font-size:0.7em;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-dim,#475569)">'
        + s.elapsedMinutes + 'min</span>' : '')
        + '</div></div></div>';

    // Highlights
    var hl = s.highlights || {};
    if (hl.biggestWin || hl.biggestRisk) {
        h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">';
        if (hl.biggestWin) h += '<div style="font-size:0.75em;color:#86efac;margin-bottom:2px">🏆 ' + _escHtml(hl.biggestWin) + '</div>';
        if (hl.biggestRisk) h += '<div style="font-size:0.75em;color:#fbbf24">⚠️ ' + _escHtml(hl.biggestRisk) + '</div>';
        h += '</div>';
    }

    // Readiness + pocket + trend row
    var rd = s.readiness || {};
    var pk = s.pocket || {};
    var tr = s.trend || {};
    var hasInsight = (rd.hasEnoughData || pk.hasEnoughData || tr.direction);
    if (hasInsight) {
        h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-wrap:wrap">';
        if (rd.hasEnoughData) {
            var rdColor = rd.deltaAvg > 0 ? '#22c55e' : rd.deltaAvg < 0 ? '#ef4444' : '#94a3b8';
            var rdSign = rd.deltaAvg > 0 ? '+' : '';
            h += '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:' + rdColor + '15;color:' + rdColor + '">Readiness ' + rdSign + rd.deltaAvg + '</span>';
        }
        if (pk.hasEnoughData) {
            var pkColor = pk.label === 'Tighter' || pk.label === 'Slightly tighter' ? '#22c55e' : pk.label === 'Looser' || pk.label === 'Slightly looser' ? '#ef4444' : '#94a3b8';
            h += '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:' + pkColor + '15;color:' + pkColor + '">Groove: ' + _escHtml(pk.label) + '</span>';
        }
        if (tr.direction) {
            var trColor = tr.direction === 'improving' ? '#22c55e' : tr.direction === 'slipping' ? '#ef4444' : '#94a3b8';
            var trLabel = tr.direction.charAt(0).toUpperCase() + tr.direction.slice(1);
            h += '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:' + trColor + '15;color:' + trColor + '">Trend: ' + trLabel + '</span>';
        }
        h += '</div>';
    }

    // Recommendations
    var recs = s.recommendations || [];
    if (recs.length) {
        h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">';
        for (var r = 0; r < recs.length; r++) {
            h += '<div style="font-size:0.72em;color:var(--text-muted,#94a3b8);padding:1px 0">→ ' + _escHtml(recs[r]) + '</div>';
        }
        h += '</div>';
    }

    // Song chips
    if (s.completedSongs && s.completedSongs.length) {
        h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);display:flex;flex-wrap:wrap;gap:4px">';
        for (var c = 0; c < s.completedSongs.length; c++) {
            h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac">✓ ' + _escHtml(s.completedSongs[c].title) + '</span>';
        }
        for (var sk = 0; sk < (s.skippedSongs || []).length; sk++) {
            h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.08);color:#fbbf24">– ' + _escHtml(s.skippedSongs[sk].title) + '</span>';
        }
        h += '</div>';
    }

    // Trend row
    if (t && t.sessionCount >= 2) {
        var trendColor = t.avgScore >= 80 ? '#22c55e' : t.avgScore >= 50 ? '#f59e0b' : '#ef4444';
        h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
        h += '<span style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase">Last ' + t.sessionCount + '</span>';
        h += '<span style="font-size:0.7em;font-weight:700;padding:2px 8px;border-radius:6px;background:' + trendColor + '15;color:' + trendColor + '">Avg ' + t.avgScore + '</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.avgCompletionRate + '% avg</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.totalCompletedMinutes + 'min</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.totalSongsCompleted + ' songs</span>';
        h += '</div>';
    }

    h += '</div>';
    return h;
}

// ── Rehearsal History (M7 Phase 3) ────────────────────────────────────────────

function renderRehearsalHistory() {
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalScorecardHistory) return '';
    var history = GLStore.getRehearsalScorecardHistory();
    if (!history || history.length < 2) return ''; // need 2+ for history to be useful

    var items = history.slice(0, 5);
    var rows = items.map(function(sc) {
        var scoreColor = sc.score >= 80 ? '#22c55e' : sc.score >= 50 ? '#f59e0b' : '#ef4444';
        var ts = sc.createdAt || sc.completedAt || '';
        var dateStr = '';
        if (ts) {
            var d = new Date(ts);
            dateStr = (d.getMonth()+1) + '/' + d.getDate();
        }
        var ti = sc.trendInputs || sc;
        var rd = sc.readiness || {};
        var pk = sc.pocket || {};
        var hl = sc.highlights || {};

        var chips = '';
        if (rd.hasEnoughData && rd.deltaAvg !== 0) {
            var rdC = rd.deltaAvg > 0 ? '#22c55e' : '#ef4444';
            chips += '<span style="font-size:0.62em;padding:1px 5px;border-radius:4px;background:'+rdC+'15;color:'+rdC+'">' + (rd.deltaAvg > 0 ? '+' : '') + rd.deltaAvg + '</span>';
        }
        if (pk.hasEnoughData) {
            var pkC = pk.label === 'Tighter' || pk.label === 'Slightly tighter' ? '#22c55e' : pk.label === 'Looser' || pk.label === 'Slightly looser' ? '#ef4444' : '#94a3b8';
            chips += '<span style="font-size:0.62em;padding:1px 5px;border-radius:4px;background:'+pkC+'15;color:'+pkC+'">'+_escHtml(pk.label)+'</span>';
        }

        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
            + '<span style="font-size:0.72em;color:var(--text-dim,#475569);width:32px;flex-shrink:0">' + dateStr + '</span>'
            + '<span style="font-size:1em;font-weight:800;color:' + scoreColor + ';width:28px;text-align:center;flex-shrink:0">' + sc.score + '</span>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.72em;font-weight:600;color:var(--text-muted,#94a3b8)">' + _escHtml(sc.label || '') + '</div>'
            + (hl.biggestWin ? '<div style="font-size:0.65em;color:var(--text-dim,#475569);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escHtml(hl.biggestWin) + '</div>' : '')
            + '</div>'
            + '<div style="display:flex;gap:4px;flex-shrink:0">' + chips + '</div>'
            + '</div>';
    }).join('');

    // Weak spots summary
    var wsHtml = '';
    if (typeof GLStore.getRehearsalWeakSpots === 'function') {
        var ws = GLStore.getRehearsalWeakSpots();
        if (ws && ws.hasEnoughData && ws.songs.length) {
            wsHtml = '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">';
            wsHtml += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px"><span style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase">Recurring Weak Spots</span>' + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('weak-spots') : '') + '</div>';
            for (var w = 0; w < Math.min(3, ws.songs.length); w++) {
                var wSong = ws.songs[w];
                var wColor = wSong.issue.severity === 'high' ? '#ef4444' : '#f59e0b';
                wsHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
                    + '<span style="font-size:0.72em;font-weight:700;color:' + wColor + '">' + _escHtml(wSong.title) + '</span>'
                    + '<span style="font-size:0.65em;color:var(--text-dim,#475569)">' + _escHtml(wSong.issue.reason) + '</span>'
                    + '</div>';
            }
            wsHtml += '</div>';
        }
    }

    return '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">📊</span>'
        + '<span class="hd-bucket__title">REHEARSAL HISTORY</span>'
        + '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim,#475569)">' + items.length + ' sessions</span>'
        + '</div>'
        + rows
        + wsHtml
        + '</div>';
}

// ── Context Banner ────────────────────────────────────────────────────────────

function _renderContextBanner(bannerType, bannerData, isStoner) {
    var gig  = bannerData && bannerData.gig;
    var plan = bannerData && bannerData.plan;

    var venueName    = gig ? _escHtml(gig.venue || 'Tonight\'s Show') : '';
    var linkedSetlist = gig ? (gig.setlistId || gig.linkedSetlist || null) : null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    if (bannerType === 'rehearsal_today') {
        var loc = plan && plan.location ? ' \xb7 \uD83D\uDCCD ' + _escHtml(plan.location) : '';
        var time = plan && plan.time ? ' at ' + _escHtml(plan.time) : '';
        var planSongs = plan && plan.plan && Array.isArray(plan.plan.songs) ? plan.plan.songs.length : 0;
        var songsLine = planSongs ? planSongs + ' song' + (planSongs > 1 ? 's' : '') + ' planned' : 'No songs planned yet';
        return [
            '<div class="home-banner home-banner--rehearse">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">\uD83C\uDFB8</span>',
            '    <div class="home-banner__text">',
            '      <strong>Rehearsal Tonight' + time + '</strong>' + loc,
            '      <div class="home-banner__sub">' + songsLine + '</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    if (!gig) return '';

    venueName    = _escHtml(gig.venue || 'Tonight\'s Show');
    linkedSetlist = gig.linkedSetlist || null;
    linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    if (bannerType === 'gig_today') {
        var doorsLine = gig.doorsTime ? ' \xb7 Doors ' + _escHtml(gig.doorsTime) : '';
        if (isStoner) {
            return [
                '<div class="home-banner home-banner--gig">',
                '  <div class="home-banner__body">',
                '    <span class="home-banner__icon">\uD83C\uDFA4</span>',
                '    <div class="home-banner__text">',
                '      <strong>' + venueName + '</strong>' + doorsLine,
                '    </div>',
                '    <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live \u2192</button>',
                '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
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
            '    <span class="home-banner__icon">\uD83C\uDFA4</span>',
            '    <div class="home-banner__text">',
            '      <strong>Tonight: ' + venueName + '</strong>' + doorsLine,
            readinessLine,
            '    </div>',
            '    <div class="home-banner__actions">',
            '      <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live \u2192</button>',
            linkedSetlist ? '      <button class="home-banner__cta home-banner__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">Setlist</button>' : '',
            '    </div>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
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
            '    <span class="home-banner__icon">\uD83D\uDCC5</span>',
            '    <div class="home-banner__text">',
            '      <strong>' + daysText + ': ' + venueName + '</strong>',
            '      <div class="home-banner__sub">' + friendlyDate + ' \xb7 Get ready</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--secondary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Prep \u2192</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
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

// ── Play Show Card ────────────────────────────────────────────────────────────

function _renderPlayShowCard(bundle, isStoner) {
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) {
        return _renderCardEmptyState('playShow');
    }

    var venueName      = nextGig.venue || 'Upcoming Show';
    var gigDate        = nextGig.date  || '';
    var linkedSetlist  = nextGig.setlistId || nextGig.linkedSetlist || null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    var daysUntil  = gigDate ? _dayDiff(_todayStr(), gigDate) : null;
    var isToday    = daysUntil === 0;
    var dateLabel  = _formatDateShort(gigDate);
    var timeLabel  = nextGig.doorsTime ? 'Doors ' + nextGig.doorsTime : '';
    if (nextGig.startTime) timeLabel = (timeLabel ? timeLabel + ' \xb7 ' : '') + 'Set ' + nextGig.startTime;

    if (isStoner) {
        return [
            '<div class="home-card home-card--playshow">',
            '  <div class="home-card__icon">\uD83C\uDFA4</div>',
            '  <div class="home-card__label">Go Live</div>',
            '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
            '  <div class="home-card__sub">' + (isToday ? 'Tonight' : dateLabel) + (timeLabel ? ' \xb7 ' + _escHtml(timeLabel) : '') + '</div>',
            '  <button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">' + (isToday ? "I\'m Ready \u2192" : "View Show \u2192") + '</button>',
            '</div>'
        ].join('');
    }

    var readinessHTML    = _renderSetlistReadinessBars(nextGig, bundle.readinessCache);
    var warningsHTML     = _renderReadinessWarnings(nextGig, bundle.readinessCache);
    var urgencyClass = isToday ? 'home-card--playshow home-card--urgent' : 'home-card--playshow';

    var ctaGoLive = '<button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">'
        + (isToday ? '\uD83C\uDFA4 Go Live \u2192' : '\uD83C\uDFA4 Activate Show') + '</button>';

    var ctaSetlist = linkedSetlist
        ? '<button class="home-card__cta home-card__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">View Setlist</button>'
        : '<button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'gigs\')">Open Gig</button>';

    var ctaCare = '<button class="home-card__cta home-card__cta--ghost" onclick="homeCarePackage()">\uD83D\uDCE6 Care Package</button>';

    return [
        '<div class="home-card ' + urgencyClass + '">',
        '  <div class="home-card__header">',
        '    <span class="home-card__icon">\uD83C\uDFA4</span>',
        '    <span class="home-card__label">Go Live</span>',
        '    ' + (isToday ? '<span class="home-card__badge home-card__badge--live">TONIGHT</span>' : (daysUntil !== null && daysUntil <= 2 ? '<span class="home-card__badge home-card__badge--soon">' + (daysUntil === 1 ? 'TOMORROW' : 'IN ' + daysUntil + ' DAYS') + '</span>' : '')),
        '  </div>',
        '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
        '  <div class="home-card__sub">' + dateLabel + (timeLabel ? ' \xb7 ' + _escHtml(timeLabel) : '') + '</div>',
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

// ── Rehearse Card ─────────────────────────────────────────────────────────────

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
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFBC</span><span class="home-card__label">Rehearse</span></div>',
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

// ── Practice Card ─────────────────────────────────────────────────────────────

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
    var _pqSc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var _pqA = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
    Object.entries(rc).forEach(function(entry) {
        var title = entry[0];
        if (!_pqA[(_pqSc[title]) || '']) return;
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

// ── Setlist Card ──────────────────────────────────────────────────────────────

function _scoreSetlistCard(bundle) {
    var setlists = bundle.setlists || [];
    var gigs = bundle.gigs || [];
    if (!setlists.length) return 0;
    var nextGig = gigs[0];
    if (nextGig && !nextGig.setlistId && !nextGig.linkedSetlist) return 2;
    if (nextGig && (nextGig.setlistId || nextGig.linkedSetlist)) return 1;
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

    var featured = null;
    if (nextGig && nextGig.setlistId) {
        featured = setlists.find(function(sl) { return sl.setlistId === nextGig.setlistId; }) || null;
    }
    if (!featured && nextGig && nextGig.linkedSetlist) {
        // Legacy fallback: name match for records without setlistId
        featured = setlists.find(function(sl) { return sl.name === nextGig.linkedSetlist; }) || null;
    }
    if (!featured) {
        featured = setlists.slice().sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
    }

    var isLinked = nextGig && featured && (nextGig.setlistId === featured.setlistId);
    var totalSongs = featured.songCount || 0;
    var setCount = (featured.sets || []).length;

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
        : (featured.date ? '\uD83D\uDCC5 ' + _escHtml(featured.date) + (featured.venue ? ' \xb7 ' + _escHtml(featured.venue) : '') : '');

    var readinessHtml = allTitles.length ? [
        '<div class="home-readiness-row" style="margin:8px 0 10px">',
        '  <span class="home-readiness-row__label">Ready</span>',
        '  <div class="home-readiness-row__bar"><div class="home-readiness-row__fill" style="width:' + readyPct + '%;background:' + readyColor + '"></div></div>',
        '  <span class="home-readiness-row__count" style="color:' + readyColor + '">' + readyCount + '/' + allTitles.length + '</span>',
        '</div>'
    ].join('') : '';

    var statLine = setCount + ' set' + (setCount !== 1 ? 's' : '') + ' \xb7 ' + totalSongs + ' songs';

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

// ── Readiness computation ─────────────────────────────────────────────────────

function _computeSetlistReadiness(gig, rc) {
    if (!gig || !gig._setlistSongs) return null;
    rc = rc || {};
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
    return parts.length ? parts.join(' \xb7 ') : null;
}

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
    return '<div class="home-card__warning-list">\u26a0 Needs work: '
        + warnings.map(function(t) { return _escHtml(t); }).join(', ')
        + '</div>';
}

// ── Empty / error states ──────────────────────────────────────────────────────

function _renderCardEmptyState(cardKey) {
    var configs = {
        playShow: { icon: '\uD83C\uDFA4', label: 'Go Live',   msg: 'No upcoming shows',   cta: 'Add a Gig', action: "showPage('gigs')" },
        rehearse: { icon: '\uD83C\uDFBC', label: 'Rehearse',  msg: 'No rehearsal scheduled', cta: 'Open Rehearsals', action: "showPage('rehearsal')" },
        practice: { icon: '\uD83C\uDFA7', label: 'Practice',  msg: 'Sign in to see your practice queue', cta: 'Open Practice', action: "showPage('practice')" },
        setlist:  { icon: '\uD83D\uDCCB', label: 'Setlists',  msg: 'No setlists yet', cta: 'Create Setlist', action: "showPage('setlists')" }
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
        + '<div style="font-size:2em;margin-bottom:12px">\u26a0\ufe0f</div>'
        + '<div>Could not load dashboard. Check connection.</div>'
        + '<button class="btn btn-ghost" style="margin-top:16px" onclick="renderHomeDashboard()">Retry</button>'
        + '</div></div>';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

function _todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function _dayDiff(dateStrA, dateStrB) {
    if (!dateStrA || !dateStrB) return null;
    try {
        var a = new Date(dateStrA + 'T12:00:00');
        var b = new Date(dateStrB + 'T12:00:00');
        return Math.round((b - a) / 86400000);
    } catch(e) { return null; }
}

function _formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    } catch(e) { return dateStr; }
}

function _bandAvgForSong(scoreObj) {
    if (!scoreObj || typeof scoreObj !== 'object') return 0;
    var vals = Object.values(scoreObj).filter(function(v) { return typeof v === 'number' && v > 0; });
    if (!vals.length) return 0;
    return vals.reduce(function(sum, v) { return sum + v; }, 0) / vals.length;
}

function _escHtml(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _resolveIsStoner() {
    var key = _getMemberKey();
    if (!key) return true;
    return false;
}

function _getMemberKey() {
    if (typeof window.getCurrentMemberKey === 'function') return window.getCurrentMemberKey();
    if (typeof window.getCurrentMemberReadinessKey === 'function') return window.getCurrentMemberReadinessKey();
    return null;
}

function bundle_readinessRef() {
    return (typeof readinessCache !== 'undefined') ? readinessCache : {};
}

// ── Band Readiness Score ──────────────────────────────────────────────────────

function _computeBandReadinessPct(bundle, scopeSongSet) {
    var rc = bundle.readinessCache || {};
    var entries = [];
    var keys = Object.keys(rc);
    for (var i = 0; i < keys.length; i++) {
        if (scopeSongSet && !scopeSongSet[keys[i]]) continue; // skip songs not in scope
        var ratings = rc[keys[i]];
        if (ratings && typeof ratings === 'object' && Object.keys(ratings).length > 0) {
            entries.push(ratings);
        }
    }
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
    var rc = bundle.readinessCache || {};
    var _rbSc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var _rbA = { prospect: 1, learning: 1, rotation: 1, gig_ready: 1 };
    var weakTitles = Object.entries(rc)
        .filter(function(e) { return _rbA[(_rbSc[e[0]]) || ''] && e[1] && _bandAvgForSong(e[1]) < 3; })
        .map(function(e) { return e[0]; });
    var onclickVal = weakTitles.length
        ? 'homeGoWeakSongs(' + JSON.stringify(weakTitles) + ')'
        : "showPage('songs')";
    return [
        '<div class="home-readiness-widget" onclick="' + onclickVal + '" style="cursor:pointer">',
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
var _ACTIVITY_TTL      = 120000;

async function _loadActivityFeed() {
    if (_activityFeedCache && (Date.now() - _activityFeedTime < _ACTIVITY_TTL)) {
        return _activityFeedCache;
    }
    try {
        var log = await window.loadMasterFile('_master_activity_log.json') || [];
        var SKIP_ACTIONS = ['join', 'login', 'signin', 'sign_in', 'joined', 'session_start', 'connected'];
        var entries = (Array.isArray(log) ? log : Object.values(log))
            .filter(function(e) {
                if (!e || !e.action || !e.time) return false;
                var a = (e.action || '').toLowerCase();
                return !SKIP_ACTIONS.some(function(s) { return a.indexOf(s) !== -1; });
            })
            .slice(-20)
            .reverse()
            .slice(0, 3);
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
    sign_in:          function(e) { return _displayName(e.user) + ' joined the session'; }
};

function _activityLabel(e) {
    var fn = _ACTION_LABELS[e.action];
    if (fn) return fn(e);
    return _displayName(e.user) + ' ' + e.action.replace(/_/g, ' ') + (e.song ? ' \xb7 ' + e.song : '');
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

// ── Register with navigation system ──────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.home = function(el) {
        window.renderHomeDashboard();
    };
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        var container = document.getElementById('page-home');
        if (container && typeof currentPage !== 'undefined' && currentPage === 'home') {
            window.refreshHomeDashboard();
        }
    }
});

console.log('\uD83C\uDFE0 home-dashboard.js loaded');
try { if (typeof invalidateHomeCache === 'function') invalidateHomeCache(); } catch(e) {}

// ── Entrance Animation ────────────────────────────────────────────────────────

function _triggerDashboardEntrance() {
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
        var feed = document.getElementById('home-activity-feed');
        if (feed) {
            setTimeout(function() {
                feed.style.transition = 'opacity 180ms ease-out';
                feed.style.opacity = '1';
            }, 180);
        }
    });
}

// ── CSS ───────────────────────────────────────────────────────────────────────

(function _injectHomeDashboardCSS() {
    var _hdCssId2 = 'home-dashboard-css-' + (typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : 'v3');
    document.querySelectorAll('style[id^="home-dashboard-css"]').forEach(function(el){el.remove();});
    if (document.getElementById(_hdCssId2)) return;
    var style = document.createElement('style');
    style.id = _hdCssId2;
    style.textContent = [
        '@keyframes glFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
        '@keyframes glFadeIn { from { opacity: 0; } to { opacity: 1; } }',
        '@keyframes glBarFill { from { width: 0 !important; } to { } }',
        '.home-anim-header { animation: glFadeIn 180ms ease-out both; }',
        '.home-anim-cards  { animation: glFadeUp 180ms ease-out both; }',
        '.home-anim-feed   { animation: glFadeIn 180ms ease-out both; animation-delay: 180ms; }',
        '.home-anim-bar    { animation: glBarFill 600ms ease-out both; }',
        '.home-dashboard { padding: 12px; max-width: 680px; margin: 0 auto; }',
        '.home-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }',
        '@media (max-width: 420px) { .home-card-grid { grid-template-columns: 1fr; } }',
        '.home-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }',
        '.home-card:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }',
        '.home-card__header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }',
        '.home-card__icon { font-size: 1.4em; flex-shrink: 0; }',
        '.home-card__label { font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); flex: 1; }',
        '.home-card__title { font-size: 0.98em; font-weight: 800; color: var(--text); line-height: 1.2; }',
        '.home-card__sub   { font-size: 0.76em; color: var(--text-muted); }',
        '.home-card__badge { font-size: 0.6em; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; }',
        '.home-card__badge--live { background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.35); }',
        '.home-card__badge--soon { background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }',
        '.home-card--urgent { border-color: rgba(102,126,234,0.4); background: linear-gradient(160deg, var(--bg-card) 60%, rgba(102,126,234,0.06)); }',
        '.home-readiness-row { display: flex; align-items: center; gap: 8px; margin: 2px 0; }',
        '.home-readiness-row__label { font-size: 0.7em; color: var(--text-dim); min-width: 36px; }',
        '.home-readiness-row__bar { flex: 1; height: 5px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }',
        '.home-readiness-row__fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }',
        '.home-readiness-row__count { font-size: 0.7em; font-weight: 700; min-width: 28px; text-align: right; }',
        '.home-card__warning-list { font-size: 0.72em; color: var(--yellow); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px; }',
        '.home-card__actions { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }',
        '.home-card__cta { width: 100%; padding: 9px 12px; border-radius: 8px; font-size: 0.82em; font-weight: 700; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; text-align: center; }',
        '.home-card__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; box-shadow: 0 2px 12px rgba(102,126,234,0.35); }',
        '.home-card__cta--primary:hover { opacity: 0.9; }',
        '.home-card__cta--secondary { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-card__cta--secondary:hover { background: rgba(255,255,255,0.1); color: var(--text); }',
        '.home-card__cta--ghost { background: transparent; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.05); font-size: 0.75em; }',
        '.home-card__cta--ghost:hover { background: rgba(255,255,255,0.04); color: var(--text-muted); }',
        '.home-readiness-widget { margin-bottom: 24px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }',
        '.home-readiness-widget__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }',
        '.home-readiness-widget__title { font-size: 0.78em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }',
        '.home-readiness-widget__pct { font-size: 1.1em; font-weight: 800; }',
        '.home-readiness-widget__bar { height: 10px; background: rgba(255,255,255,0.07); border-radius: 5px; overflow: hidden; margin-bottom: 4px; }',
        '.home-readiness-widget__fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }',
        '.home-readiness-widget__label { font-size: 0.72em; color: var(--text-dim); }',
        '.home-activity { margin-top: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; min-height: 0; }',
        '.home-activity:empty { display: none; }',
        '.home-activity__title { font-size: 0.72em; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }',
        '.home-activity__item { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }',
        '.home-activity__item:last-child { border-bottom: none; }',
        '.home-activity__text { font-size: 0.8em; color: var(--text-muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.home-activity__time { font-size: 0.7em; color: var(--text-dim); flex-shrink: 0; }',
        '.home-card--stub { opacity: 0.75; }',
        '.home-card--stub .home-card__icon { font-size: 1.1em; }',
        '.home-card__stub-msg { font-size: 0.72em; color: var(--text-dim); padding: 4px 0 8px 0; }',
        '.home-card--empty { border-style: dashed; }',
        '.home-card__empty-msg { font-size: 0.78em; color: var(--text-dim); padding: 8px 0; }',
        '.home-banner { border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; position: relative; }',
        '.home-banner--gig  { background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.12)); border: 1px solid rgba(102,126,234,0.3); }',
        '.home-banner--soon { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }',
        '.home-banner--rehearse { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); }',
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
        '.home-weak { margin: 0 0 16px; padding: 12px 14px; background: var(--bg-card); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; }',
        '.home-weak__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }',
        '.home-weak__title-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }',
        '.home-weak__count { font-size: 0.72em; color: var(--text-dim); }',
        '.home-weak__list { display: flex; flex-direction: column; gap: 1px; margin-bottom: 10px; }',
        '.home-weak__row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }',
        '.home-weak__row:hover { background: rgba(255,255,255,0.05); }',
        '.home-weak__dot { font-size: 0.75em; flex-shrink: 0; }',
        '.home-weak__title { flex: 1; font-size: 0.85em; font-weight: 600; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.home-weak__meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }',
        '.home-weak__age { font-size: 0.7em; color: var(--text-dim); }',
        '.home-weak__more { display: block; font-size: 0.72em; color: var(--text-dim); text-align: center; margin: -4px 0 8px; }',
        '.home-weak__cta { width: 100%; padding: 8px 12px; border-radius: 8px; font-size: 0.82em; font-weight: 700; cursor: pointer; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #fca5a5; font-family: inherit; transition: all 0.15s; text-align: center; }',
        '.home-weak__cta:hover { background: rgba(239,68,68,0.15); color: #fecaca; }',
        '.home-weak__gig-badge { display: inline-block; font-size: 0.6em; font-weight: 700; color: #a78bfa; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 4px; padding: 0 5px; margin-left: 5px; vertical-align: middle; line-height: 1.6; }',
    ].join('\n');
    document.head.appendChild(style);
}());

// ── Weak Songs ────────────────────────────────────────────────────────────────
// _weakScore, _buildRecencyMap, _computeWeakSongs removed — use GLStore.getNowFocus()
var _WEAK_DISPLAY      = 3;

window.homeGoWeakSongs = function homeGoWeakSongs(titles) {
    if (!titles || !titles.length) { showPage('songs'); return; }
    showPage('songs');
    setTimeout(function() {
        var searchEl = document.getElementById('songSearch');
        if (!searchEl) return;
        if (titles.length === 1) {
            searchEl.value = titles[0];
            if (typeof renderSongs === 'function') renderSongs(
                (typeof currentFilter !== 'undefined' ? currentFilter : 'all'), titles[0]
            );
            setTimeout(function() {
                if (typeof selectSong === 'function') selectSong(titles[0]);
            }, 150);
        } else {
            searchEl.value = '';
            if (typeof renderSongs === 'function') renderSongs('all', '');
            searchEl.focus();
            showToast('\uD83D\uDCCB ' + titles.length + ' weak songs \u2014 check readiness chains on each');
        }
    }, 200);
};

function _fillWeakSongs(bundle) {
    var el = document.getElementById('home-weak-songs') || document.getElementById('hdWeakSongsCard');
    if (!el) return;

    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [], count: 0 };
    var weak = (focus.list || []).slice(0, _WEAK_DISPLAY);

    if (!weak.length) {
        el.innerHTML = '<div class="app-card home-anim-cards">'
            + '<h3 style="margin:0 0 8px">\u2705 All Good</h3>'
            + '<div style="color:var(--text-dim);font-size:0.82em">No active songs below readiness threshold.</div>'
            + '</div>';
        return;
    }

    var titles    = weak.map(function(s) { return s.title; });
    var titlesEsc = JSON.stringify(titles).replace(/'/g, "\\'");
    var hasGigSongs = weak.some(function(s) { return s.inSetlist; });

    var rows = weak.map(function(s) {
        var avg    = s.avg.toFixed(1);
        var color  = s.avg < 2.0 ? 'var(--red,#ef4444)' : 'var(--yellow,#f59e0b)';
        var dot    = s.avg < 2.0 ? '\uD83D\uDD34' : '\uD83D\uDFE1';
        return '<div class="home-weak__row" onclick="homeGoWeakSongs([\'' + s.title.replace(/'/g, "\\'") + '\'])" title="Practice this song">'
            + '<span class="home-weak__dot">' + dot + '</span>'
            + '<span class="home-weak__title">' + _escHtml(s.title) + (s.inSetlist ? '<span class="home-weak__gig-badge">\uD83C\uDFA4 Next Gig</span>' : '') + '</span>'
            + '<span class="home-weak__meta">'
            +   '<span style="color:' + color + ';font-weight:700">' + avg + '/5</span>'
            + '</span>'
            + '</div>';
    }).join('');

    var totalWeak = focus.count || 0;

    var moreLabel = totalWeak > _WEAK_DISPLAY
        ? '<span class="home-weak__more">+' + (totalWeak - _WEAK_DISPLAY) + ' more below threshold</span>'
        : '';

    el.innerHTML = [
        '<div class="home-weak home-anim-feed">',
        '  <div class="home-weak__header">',
        '    <span class="home-weak__title-label">' + (hasGigSongs ? '\uD83C\uDFA4 Tighten Before Next Gig' : '\uD83C\uDFAF Songs to Tighten') + '</span>',
        '    <span class="home-weak__count">' + totalWeak + ' below readiness threshold</span>',
        '  </div>',
        '  <div class="home-weak__list">' + rows + '</div>',
        moreLabel,
        '  <button class="home-weak__cta" onclick="homeGoWeakSongs(' + titlesEsc + ')">Practice \u2192</button>',
        '</div>'
    ].join('');
}

function _scheduleWeakSongsFill(bundle) {
    setTimeout(function() { _fillWeakSongs(bundle); }, 220);
}

// ── Mission Board CSS ─────────────────────────────────────────────────────────
(function() {
  var _hdCssId = 'hd-mission-css-' + (typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : 'v4');
  document.querySelectorAll('style[id^="hd-mission-css"]').forEach(function(el){el.remove();});
  if (document.getElementById(_hdCssId)) return;
  var s = document.createElement('style');
  s.id = _hdCssId;
  s.textContent = [
    '.hd-mission-board{display:flex;flex-direction:column;gap:20px;padding:12px 0 32px}',
    '.hd-strip{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:2px}',
    '.hd-strip__chip{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap}',
    '.hd-strip__chip--gig{background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)}',
    '.hd-strip__chip--rehearse{background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.25)}',
    '.hd-strip__chip--ready{background:rgba(74,222,128,0.1);color:var(--green);border:1px solid rgba(74,222,128,0.2)}',
    '.hd-strip__chip--weak{background:rgba(251,191,36,0.1);color:var(--yellow);border:1px solid rgba(251,191,36,0.2)}',
    '.hd-strip__chip--ok{background:rgba(74,222,128,0.08);color:var(--green);border:1px solid rgba(74,222,128,0.15)}',
    '.hd-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;padding:20px 18px 16px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.4);position:relative;overflow:hidden;margin-bottom:4px}',
    '.hd-hero--gig{background:linear-gradient(135deg,#1b2a4a 0%,#141e35 60%,#0e1628 100%);border-color:rgba(102,126,234,0.25)}',
    '.hd-hero--rehearse{background:linear-gradient(135deg,#0f1a2e 0%,#1a2744 60%,#0a1628 100%);border-color:rgba(99,102,241,0.2)}',
    '.hd-hero--urgent{border-color:rgba(239,68,68,0.4)!important;box-shadow:0 4px 32px rgba(239,68,68,0.15)}',
    '.hd-hero--soon{border-color:rgba(251,191,36,0.3)!important}',
    '.hd-hero--empty{background:rgba(255,255,255,0.02);border-style:dashed}',
    '.hd-hero__eyebrow{font-size:10px;font-weight:800;letter-spacing:0.14em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px}',
    '.hd-hero__badge{font-size:9px;font-weight:800;letter-spacing:0.1em;padding:2px 7px;border-radius:4px;text-transform:uppercase}',
    '.hd-hero__badge--live{background:#ef4444;color:#fff}',
    '.hd-hero__badge--soon{background:rgba(251,191,36,0.2);color:var(--yellow);border:1px solid rgba(251,191,36,0.4)}',
    '.hd-hero__badge--rehearse{background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.4)}',
    '.hd-hero__title{font-size:1.35em;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:4px}',
    '.hd-hero__title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}',
    '.hd-hero__ready-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid}',
    '.hd-hero__sub{font-size:0.78em;color:var(--text-dim);margin-bottom:6px}',
    '.hd-hero__setlist{font-size:0.75em;color:var(--text-dim);margin-bottom:8px}',
    '.hd-hero__countdown{font-size:0.75em;color:var(--text-dim);margin-bottom:6px}',
    '.hd-hero__coach{font-size:12px;color:var(--text-dim);font-style:italic;margin:4px 0 2px;border-left:2px solid rgba(255,255,255,0.1);padding-left:8px}',
    '.hd-hero__pct-row{display:flex;align-items:center;gap:8px;margin:10px 0 4px}',
    '.hd-hero__pct-label{font-size:10px;color:var(--text-dim);white-space:nowrap}',
    '.hd-hero__pct-track{width:100%;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden}',
    '.hd-hero__pct-fill{height:100%;border-radius:3px;transition:width 0.6s ease}',
    '.hd-hero__pct-val{font-size:11px;font-weight:700;white-space:nowrap}',
    '.hd-hero__risk{font-size:12px;color:var(--text-dim);margin-bottom:4px}',
    '.hd-hero__risk strong{color:var(--yellow)}',
    '.hd-hero__days-away{font-size:0.85em;font-weight:700;color:var(--yellow);background:rgba(251,191,36,0.12);border-radius:4px;padding:1px 6px;margin-left:2px}',
    '.hd-hero__risk-avg{font-size:10px;font-weight:800;margin-left:6px;background:rgba(239,68,68,0.15);padding:1px 5px;border-radius:3px}',
    '.hd-hero__readiness{margin:8px 0 4px}',
    '.hd-hero__warnings{margin-bottom:8px}',
    '.hd-hero__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.hd-hero__cta{padding:9px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;transition:all 0.15s;touch-action:manipulation}',
    '.hd-hero__cta--primary{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;box-shadow:0 2px 12px rgba(99,102,241,0.35)}',
    '.hd-hero__cta--primary:hover{filter:brightness(1.1)}',
    '.hd-hero__cta--golive{background:linear-gradient(135deg,#dc2626,#b91c1c)!important;box-shadow:0 2px 12px rgba(239,68,68,0.4)!important}',
    '.hd-hero__cta--secondary{background:rgba(255,255,255,0.06);color:var(--text-dim);border:1px solid rgba(255,255,255,0.12)}',
    '.hd-hero__cta--secondary:hover{background:rgba(255,255,255,0.1);color:var(--text)}',
    '.hd-hero__cta--tertiary{background:rgba(255,255,255,0.04);color:var(--text-dim);border:1px solid rgba(255,255,255,0.08);font-size:12px}',
    // Spine container
    '.hd-spine-container{position:relative;padding-left:28px}',
    '.hd-spine-container::before{content:"";position:absolute;left:8px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,rgba(99,102,241,0.25) 0%,rgba(99,102,241,0.08) 100%);border-radius:1px}',
    '@media(max-width:480px){.hd-spine-container{padding-left:0}.hd-spine-container::before{display:none}}',
    // Phase blocks
    '.hd-phase{position:relative;margin-bottom:24px;opacity:0.7;transition:opacity 0.3s}',
    '.hd-phase--active{opacity:1}',
    '.hd-phase::before{content:"";position:absolute;left:-24px;top:6px;width:10px;height:10px;border-radius:50%;background:rgba(99,102,241,0.2);border:2px solid rgba(99,102,241,0.35)}',
    '.hd-phase--active::before{background:rgba(99,102,241,0.5);border-color:#667eea;box-shadow:0 0 8px rgba(99,102,241,0.3)}',
    '.hd-phase--done::before{background:rgba(34,197,94,0.4);border-color:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.2)}',
    '.hd-phase--current::before{background:#667eea;border-color:#818cf8;box-shadow:0 0 12px rgba(99,102,241,0.5)}',
    '.hd-phase--current .hd-phase__label{color:rgba(99,102,241,0.9)}',
    '@media(max-width:480px){.hd-phase::before{display:none}}',
    '.hd-phase__label{font-size:9px;font-weight:800;letter-spacing:0.18em;color:rgba(99,102,241,0.4);text-transform:uppercase;margin-bottom:8px;margin-left:2px}',
    '.hd-phase--active .hd-phase__label{color:rgba(99,102,241,0.7)}',
    '@media(max-width:480px){.hd-phase__label{margin-left:0}}',
    '.hd-phase__cards{margin-bottom:0}',
    '.hd-buckets{display:grid;grid-template-columns:1fr 1fr;gap:20px}',
    '@media(max-width:480px){.hd-buckets{grid-template-columns:1fr}}',
    '.hd-bucket{background:rgba(255,255,255,0.03);border-radius:14px;padding:14px 14px 12px;border:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;gap:8px}',
    '.hd-bucket--weak{border-color:rgba(239,68,68,0.15)!important;background:rgba(239,68,68,0.03)!important}',
    '.hd-bucket--ok{border-color:rgba(74,222,128,0.2)!important}',
    '.hd-bucket__header{display:flex;align-items:center;gap:6px;margin-bottom:2px}',
    '.hd-bucket__icon{font-size:14px}',
    '@keyframes hdGlowPulse{0%{text-shadow:0 0 10px currentColor,0 0 20px rgba(34,197,94,0.2)}50%{text-shadow:0 0 18px currentColor,0 0 35px rgba(34,197,94,0.5)}100%{text-shadow:0 0 10px currentColor,0 0 20px rgba(34,197,94,0.2)}}',
    '.hd-score-pulse{animation:hdGlowPulse 3s ease-in-out infinite}',
    '.hd-bucket__title{font-size:10px;font-weight:800;letter-spacing:0.13em;color:var(--text-dim);text-transform:uppercase;flex:1}',
    '.hd-bucket__count{font-size:10px;font-weight:700;color:var(--yellow);background:rgba(251,191,36,0.12);padding:2px 7px;border-radius:20px}',
    '.hd-bucket__empty{font-size:12px;color:var(--text-dim);font-style:italic}',
    '.hd-bucket__ok{font-size:12px;color:var(--green)}',
    '.hd-bucket__more{font-size:11px;color:var(--text-dim);margin-top:3px}',
    '.hd-bucket__song-row{display:flex;align-items:baseline;gap:6px;font-size:12px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)}',
    '.hd-bucket__song-row:last-child{border-bottom:none}',
    '.hd-bucket__song-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hd-bucket__list{display:flex;flex-direction:column;gap:2px;margin:4px 0 8px}',
    '.hd-bucket__cta{padding:8px 12px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all 0.15s;touch-action:manipulation;margin-top:auto}',
    '.hd-bucket__cta--primary{background:linear-gradient(135deg,#15803d,#166534);color:#4ade80;border:1px solid rgba(74,222,128,0.35);box-shadow:0 2px 16px rgba(74,222,128,0.35),0 0 0 1px rgba(74,222,128,0.1)}',
    '.hd-bucket__cta--primary:hover{filter:brightness(1.15)}',
    '.hd-bucket__cta--ghost{background:transparent;color:var(--text-dim);border:1px solid rgba(255,255,255,0.1)}',
    '.hd-bucket__cta--ghost:hover{background:rgba(255,255,255,0.05);color:var(--text)}',
    '.hd-intel__row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)}',
    '.hd-intel__row:last-child{border-bottom:none}',
    '.hd-intel__label{color:var(--text-dim);flex-shrink:0}',
    '.hd-intel__value{color:var(--text);text-align:right;font-weight:600;min-width:0;font-size:11px}',
    '.hd-activity-demoted{opacity:0.75}',
    /* Pct bar enhancements — stacked: number, bar, label */
    '.hd-hero__pct-row{display:flex;flex-direction:column;gap:0;margin:12px 0 8px;width:100%}',
    '.hd-hero__pct-track{width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:5px}',
    '.hd-hero__pct-fill{height:100%;border-radius:4px;transition:width 0.6s ease}',
    '.hd-hero__pct-val{font-size:32px;font-weight:900;line-height:1;margin-bottom:6px;letter-spacing:-0.02em}',
    '.hd-hero__pct-state{font-size:11px;font-weight:700}',
    /* Risk pill */
    /* Gig Confidence Meter */
    '.hd-conf{margin:10px 0 6px;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid;border-radius:10px}',
    '.hd-conf__header{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.hd-conf__label{font-size:0.65em;font-weight:800;letter-spacing:0.1em;color:var(--text-dim,#475569);text-transform:uppercase}',
    '.hd-conf__level{font-size:0.95em;font-weight:800}',
    '.hd-conf__reasons{font-size:0.72em;color:var(--text-muted,#94a3b8);margin-top:3px}',
    '.hd-conf__reason{white-space:nowrap}',
    '.hd-hero__risk-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:4px 10px;margin:4px 0 8px}',
    '.hd-hero__risk-song{font-size:12px;font-weight:700;color:#f97316}',
    '.hd-hero__risk-label{font-size:9px;font-weight:800;letter-spacing:0.1em;color:rgba(249,115,22,0.7);text-transform:uppercase}',
    /* Urgency badges */
    '.hd-bucket__urgency-badge{font-size:9px;font-weight:800;letter-spacing:0.06em;padding:1px 5px;border-radius:3px;vertical-align:middle;margin-left:4px}',
    '.hd-bucket__urgency-badge--critical{background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.3)}',
    '.hd-bucket__urgency-badge--warn{background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.25)}',
    /* Mini readiness bar in rehearsal goal */
    '.hd-bucket__mini-bar{height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden}',
    '.hd-bucket__mini-fill{height:100%;border-radius:2px}',
    /* Reduced border opacity + deeper shadow on buckets */
    '.hd-bucket{background:rgba(255,255,255,0.025);border-radius:14px;padding:14px 14px 12px;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2)}',
    /* Hero padding increase */
    '.hd-hero{background:linear-gradient(145deg,#0d0d1a 0%,#12172e 40%,#0c1f3f 100%);border-radius:16px;padding:24px 20px 18px;border:1px solid rgba(255,255,255,0.09);box-shadow:0 8px 40px rgba(0,0,0,0.65);position:relative;overflow:hidden;margin-bottom:4px}',
    '.hd-hero__title{font-size:1.55em;font-weight:800;color:var(--text);line-height:1.15;margin-bottom:4px}',
    /* Intel row spacing */
    '.hd-intel__row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06)}',
    '.hd-intel__rows{display:flex;flex-direction:column}',
    '.hd-mission-board .home-readiness-widget{display:none!important}',
    '.hd-mission-board .home-banner{display:none!important}',
    /* ── Command Center layout ── */
    '.hd-command-center{display:flex;flex-direction:column;gap:16px;padding:12px 0 32px;max-width:680px;margin:0 auto}',
    /* CC Header */
    '.hd-cc-header{display:flex;align-items:center;justify-content:space-between;padding:0 4px}',
    '.hd-cc-header__title{font-size:1.2em;font-weight:800;color:var(--text,#f1f5f9);letter-spacing:-0.01em}',
    '.hd-cc-header__date{font-size:0.72em;font-weight:600;color:var(--text-dim,#475569);margin-top:1px}',
    '.hd-cc-orient{display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.1);border-radius:8px;margin-top:8px}',
    '.hd-cc-orient__text{flex:1;font-size:0.72em;color:var(--text-muted,#94a3b8);line-height:1.4}',
    '.hd-cc-orient__text strong{color:var(--text,#f1f5f9);font-weight:700}',
    '.hd-cc-orient__dismiss{flex-shrink:0;padding:4px 12px;border-radius:6px;background:rgba(99,102,241,0.12);color:#818cf8;border:none;font-weight:700;font-size:0.68em;cursor:pointer;white-space:nowrap}',
    '.hd-cc-orient__dismiss:hover{background:rgba(99,102,241,0.2)}',
    '.hd-cc-chip{font-size:10px;font-weight:800;letter-spacing:0.06em;padding:3px 10px;border-radius:20px;border:1px solid;white-space:nowrap}',
    /* CC Next Step inline */
    '.hd-hero:has(+.hd-cc-nextstep){border-radius:16px 16px 0 0;margin-bottom:0}',
    '.hd-cc-nextstep{display:flex;align-items:center;gap:10px;padding:10px 14px 12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-top:1px solid rgba(99,102,241,0.12);border-radius:0 0 12px 12px}',
    '.hd-cc-nextstep__icon{font-size:1.1em;color:#818cf8;flex-shrink:0}',
    '.hd-cc-nextstep__text{flex:1;min-width:0}',
    '.hd-cc-nextstep__label{font-weight:700;font-size:0.85em;color:var(--text,#f1f5f9);display:block}',
    '.hd-cc-nextstep__desc{font-size:0.72em;color:var(--text-dim,#475569);display:block;margin-top:1px}',
    '.hd-cc-nextstep__cta{padding:5px 14px;border-radius:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:700;font-size:0.78em;cursor:pointer;white-space:nowrap;flex-shrink:0}',
    '.hd-cc-nextstep__cta:hover{filter:brightness(1.1)}',
    /* Workflow hero (no gig/rehearsal) */
    '.hd-hero--workflow{background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.02));border-color:rgba(99,102,241,0.2)}',
    /* Band Health Row */
    '.hd-health-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
    '.hd-health-row::-webkit-scrollbar{display:none}',
    '.hd-health-tile{flex:1;min-width:0;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 10px 10px;text-align:center;cursor:pointer;transition:border-color 0.15s,transform 0.15s;position:relative}',
    '.hd-health-tile:hover{border-color:rgba(255,255,255,0.18);transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.2)}',
    '.hd-health-tile::after{content:"\\2192";position:absolute;bottom:4px;right:8px;font-size:0.6em;color:rgba(255,255,255,0.12);transition:color 0.15s}',
    '.hd-health-tile:hover::after{color:rgba(255,255,255,0.3)}',
    '.hd-health-tile__icon{font-size:1.1em;margin-bottom:4px}',
    '.hd-health-tile__value{font-size:1.35em;font-weight:900;line-height:1.1}',
    '.hd-health-tile__label{font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:var(--text-dim,#475569);text-transform:uppercase;margin-top:2px}',
    '.hd-health-tile__sub{font-size:0.65em;font-weight:600;margin-top:1px}',
    '@media(max-width:480px){.hd-health-row{flex-wrap:wrap}.hd-health-tile{min-width:calc(50% - 6px)}}',
    /* Health row wrapper + attribution */
    '.hd-health-row-wrap{display:flex;flex-direction:column;gap:4px}',
    '.hd-health-attrib{font-size:0.62em;font-weight:600;color:var(--text-dim,#475569);letter-spacing:0.04em;padding:0 2px;display:flex;align-items:center;gap:4px}',
    '.hd-health-attrib__title{font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim,#475569)}',
    /* Band Momentum */
    '.hd-momentum{display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px}',
    '.hd-momentum__arrow{font-size:1.2em;font-weight:800;line-height:1}',
    '.hd-momentum__label{font-size:0.82em;font-weight:700}',
    '.hd-momentum__reason{font-size:0.7em;color:var(--text-dim,#475569);flex:1}',
    '.hd-narrative-bridge{font-size:0.58em;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.12);padding:4px 2px 0}',
    /* Setup guidance (progressive discovery) */
    '.hd-setup-guidance{display:flex;flex-direction:column;gap:6px}',
    '.hd-setup-step{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:10px}',
    '.hd-setup-step__icon{font-size:1.1em;flex-shrink:0}',
    '.hd-setup-step__text{flex:1;font-size:0.78em;color:var(--text-muted,#94a3b8);line-height:1.3}',
    '.hd-setup-step__cta{padding:5px 12px;border-radius:7px;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.2);font-weight:700;font-size:0.72em;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all 0.15s}',
    '.hd-setup-step__cta:hover{background:rgba(99,102,241,0.2);color:#a5b4fc}',
    /* Priority Queue */
    '.hd-pq{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px}',
    '.hd-pq__header{font-size:10px;font-weight:800;letter-spacing:0.14em;color:var(--text-dim,#475569);text-transform:uppercase;margin-bottom:10px}',
    '.hd-pq__empty{font-size:12px;color:var(--text-dim,#475569);font-style:italic}',
    '.hd-pq__item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)}',
    '.hd-pq__item:last-child{border-bottom:none}',
    '.hd-pq__rank{font-size:0.72em;font-weight:800;color:var(--text-dim,#475569);width:20px;text-align:center;flex-shrink:0}',
    '.hd-pq__body{flex:1;min-width:0}',
    '.hd-pq__label{font-size:0.85em;font-weight:700;color:var(--text,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hd-pq__desc{font-size:0.7em;color:var(--text-dim,#475569);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.hd-pq__badge{font-size:9px;font-weight:800;letter-spacing:0.06em;padding:1px 6px;border-radius:4px;border:1px solid;vertical-align:middle;margin-left:4px}',
    '.hd-pq__cta{padding:6px 14px;border-radius:8px;background:rgba(255,255,255,0.06);color:var(--text-muted,#94a3b8);border:1px solid rgba(255,255,255,0.1);font-weight:700;font-size:0.75em;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all 0.15s}',
    '.hd-pq__cta:hover{background:rgba(255,255,255,0.1);color:var(--text,#f1f5f9)}',
    /* Recent Changes */
    '.hd-changes{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:14px}',
    '.hd-changes__header{font-size:10px;font-weight:800;letter-spacing:0.14em;color:var(--text-dim,#475569);text-transform:uppercase;margin-bottom:10px}',
    '.hd-changes__scorecard{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:6px}',
    '.hd-changes__sc-label{font-size:0.78em;color:var(--text-muted,#94a3b8);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hd-changes__sc-time{font-size:0.68em;color:var(--text-dim,#475569);flex-shrink:0}',
    '.hd-changes__timeline{margin-bottom:8px}',
    '.hd-changes__strip{position:relative;height:16px;background:#0f172a;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.05)}',
    '.hd-changes__strip-meta{font-size:0.62em;color:var(--text-dim,#475569);margin-top:3px}',
    /* Impact feedback */
    '.hd-changes__impacts{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)}',
    '.hd-changes__impact{display:flex;align-items:center;gap:8px;padding:4px 0}',
    '.hd-changes__impact-icon{font-size:0.9em;flex-shrink:0}',
    '.hd-changes__impact-text{font-size:0.78em;font-weight:600}'
  ].join('');
  document.head.appendChild(s);
})();

// ── Focus change listener — re-render Home when focus data changes ──────────
if (typeof GLStore !== 'undefined' && GLStore.on) {
  GLStore.on('focusChanged', function() {
    if (typeof currentPage !== 'undefined' && currentPage === 'home') {
      invalidateHomeCache();
    }
  });
}
