// ============================================================================
// js/core/gl-avatar-guide.js — Avatar Guide: Contextual Guidance Engine
//
// Lightweight rule-based guide that evolves from Fan → Bandmate → Coach.
// Phase 1: rule-based triggers from existing GrooveLinx data.
// Phase 2: context-aware with Claude API (designed, not built).
// Phase 3: passive capture + automation (designed, not built).
//
// DEPENDS ON: GLStore, existing dashboard data
// ============================================================================

'use strict';

window.GLAvatarGuide = (function() {

    // ── State ────────────────────────────────────────────────────────────────

    var _STORAGE_KEY = 'gl_avatar';
    var _panelOpen = false;
    var _currentMessage = null;
    var _messageQueue = [];
    var _dismissed = {}; // { tipId: timestamp }
    var _cooldowns = {}; // { tipId: lastShownTimestamp }

    var STAGE = { FAN: 'fan', BANDMATE: 'bandmate', COACH: 'coach' };

    function _loadState() {
        try {
            var raw = localStorage.getItem(_STORAGE_KEY);
            if (raw) {
                var s = JSON.parse(raw);
                _dismissed = s.dismissed || {};
                _cooldowns = s.cooldowns || {};
            }
        } catch(e) {}
    }

    function _saveState() {
        try {
            localStorage.setItem(_STORAGE_KEY, JSON.stringify({ dismissed: _dismissed, cooldowns: _cooldowns }));
        } catch(e) {}
    }

    // ── Stage Detection ──────────────────────────────────────────────────────

    function getStage() {
        var songCount = (typeof allSongs !== 'undefined') ? allSongs.length : 0;
        var hasReadiness = false;
        try {
            var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
            hasReadiness = Object.keys(rc).length > 5;
        } catch(e) {}
        var hasSessions = false;
        try { hasSessions = typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache && _rhSessionsCache.length >= 3; } catch(e) {}

        if (hasSessions && hasReadiness) return STAGE.COACH;
        if (songCount > 10 && hasReadiness) return STAGE.BANDMATE;
        return STAGE.FAN;
    }

    // ── Guidance Library ─────────────────────────────────────────────────────

    var GUIDANCE = [
        // ── FAN stage: welcoming, simple ──
        { id: 'welcome', stage: 'fan', trigger: 'first_visit', page: 'home',
          message: 'Welcome to GrooveLinx! I\u2019m here to help your band get tighter.',
          coach: 'Let\u2019s start by adding a few songs.',
          actions: [{ label: 'Add Songs', onclick: "showPage('songs')" }, { label: 'Later', dismiss: true }],
          cooldown: 0, dismissible: true },

        { id: 'empty_songs', stage: 'fan', trigger: 'no_songs', page: 'songs',
          message: 'Your setbook is empty \u2014 add 3\u20135 songs to get started.',
          coach: 'Start with songs you\u2019re playing at your next gig.',
          actions: [{ label: 'Add Songs', onclick: "showPage('songs')" }, { label: 'Import Starter Pack', onclick: 'showStarterPackImport()' }],
          cooldown: 86400000, dismissible: true },

        { id: 'first_songs_added', stage: 'fan', trigger: 'songs_added_first', page: 'home',
          message: 'Nice \u2014 let\u2019s run one.',
          coach: 'Listening through your set is the fastest way to tighten up.',
          actions: [{ label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }],
          cooldown: 0, dismissible: true },

        { id: 'empty_setlist', stage: 'fan', trigger: 'no_setlists', page: 'setlists',
          message: 'No setlists yet. Build one for your next gig or rehearsal.',
          actions: [{ label: 'Create Setlist', onclick: 'createNewSetlist()' }],
          cooldown: 86400000, dismissible: true },

        { id: 'first_practice_done', stage: 'fan', trigger: 'first_practice_complete', page: 'home',
          message: 'First set done. That\u2019s how bands get tighter.',
          coach: 'Next: run a full rehearsal with timing.',
          actions: [{ label: '\uD83C\uDFB8 Start Rehearsal', onclick: "showPage('rehearsal')" }],
          cooldown: 0, dismissible: true },

        { id: 'practice_nudge', stage: 'fan', trigger: 'not_practiced_today', page: 'home',
          message: 'No reps today yet. A quick run makes a difference.',
          actions: [{ label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }],
          cooldown: 43200000, dismissible: true },

        // ── BANDMATE stage: context-aware ──
        { id: 'weak_songs_exist', stage: 'bandmate', trigger: 'has_weak_songs', page: 'home',
          message: '{weakCount} songs still need reps.',
          coach: 'Weakest ones first \u2014 biggest bang for your time.',
          actions: [{ label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }],
          cooldown: 43200000, dismissible: true },

        { id: 'gig_soon', stage: 'bandmate', trigger: 'gig_within_2_days', page: 'home',
          message: 'Gig in {daysOut} day{s}. Run the set once more.',
          actions: [{ label: 'Run the Set', onclick: "hdPlayBundle('gig')" }],
          cooldown: 21600000, dismissible: true },

        { id: 'post_rehearsal', stage: 'bandmate', trigger: 'just_finished_rehearsal', page: 'home',
          message: 'Good session. Don\u2019t forget to add notes or attach the mixdown.',
          actions: [{ label: 'Add Notes', onclick: "showPage('rehearsal')" }],
          cooldown: 0, dismissible: true },

        { id: 'no_rehearsal_this_week', stage: 'bandmate', trigger: 'no_rehearsal_this_week', page: 'home',
          message: 'No rehearsal this week. Time to schedule one.',
          actions: [{ label: 'Open Calendar', onclick: "showPage('calendar')" }],
          cooldown: 86400000, dismissible: true },

        { id: 'scorecard_issue', stage: 'bandmate', trigger: 'scorecard_has_issues', page: 'home',
          message: 'Scorecard flagged: {topIssue}',
          coach: 'Focus here to see the biggest improvement.',
          actions: [{ label: 'See Scorecard', onclick: "showPage('home')" }],
          cooldown: 86400000, dismissible: true },

        // ── COACH stage: insight-driven ──
        { id: 'transitions_slow', stage: 'coach', trigger: 'sessions_running_long', page: 'home',
          message: 'Recent rehearsals are running long. Transitions might need tightening.',
          coach: 'Stricter time budgets per song will fix this.',
          actions: [{ label: 'Plan Rehearsal', onclick: "showPage('rehearsal')" }],
          cooldown: 172800000, dismissible: true },

        { id: 'band_improving', stage: 'coach', trigger: 'trend_improving', page: 'home',
          message: 'The band is getting tighter. Keep this rhythm going.',
          cooldown: 172800000, dismissible: true },

        { id: 'keep_going', stage: 'coach', trigger: 'practiced_but_weak_remain', page: 'home',
          message: 'Good work today. {weakCount} songs still need attention.',
          coach: 'One more session this week could make a real difference.',
          actions: [{ label: 'Keep Going', onclick: "hdPlayBundle('focus')" }],
          cooldown: 43200000, dismissible: true },

        { id: 'mixdown_reminder', stage: 'bandmate', trigger: 'recent_session_no_mixdown', page: 'rehearsal',
          message: 'Last rehearsal has no recording attached. Got a mixdown to upload?',
          actions: [{ label: 'Add Mixdown', onclick: "showPage('rehearsal')" }],
          cooldown: 86400000, dismissible: true }
    ];

    // ── Trigger Evaluation ───────────────────────────────────────────────────

    function evaluate(context) {
        _loadState();
        var stage = getStage();
        var stageOrder = { fan: 0, bandmate: 1, coach: 2 };
        var now = Date.now();

        for (var i = 0; i < GUIDANCE.length; i++) {
            var g = GUIDANCE[i];
            // Stage filter: show guidance at or below current stage
            if (stageOrder[g.stage] > stageOrder[stage]) continue;
            // Page filter
            if (g.page && context.page && g.page !== context.page && g.page !== 'any') continue;
            // Dismissed permanently
            if (_dismissed[g.id] === 'permanent') continue;
            // Cooldown
            if (g.cooldown && _cooldowns[g.id] && (now - _cooldowns[g.id]) < g.cooldown) continue;

            // Evaluate trigger
            if (_checkTrigger(g.trigger, context)) {
                // Template message with context vars
                var msg = _template(g.message, context);
                var coach = g.coach ? _template(g.coach, context) : '';
                return { id: g.id, message: msg, coach: coach, actions: g.actions || [], dismissible: g.dismissible !== false, stage: g.stage };
            }
        }
        return null;
    }

    function _checkTrigger(trigger, ctx) {
        switch (trigger) {
            case 'first_visit': return !localStorage.getItem('gl_avatar_welcomed');
            case 'no_songs': return (ctx.songCount || 0) < 3;
            case 'songs_added_first': return (ctx.songCount || 0) >= 3 && !localStorage.getItem('gl_avatar_first_songs');
            case 'no_setlists': return (ctx.setlistCount || 0) === 0;
            case 'first_practice_complete': return ctx.justCompletedPractice && !localStorage.getItem('gl_avatar_first_practice');
            case 'not_practiced_today': return !ctx.practicedToday && (ctx.songCount || 0) >= 3;
            case 'has_weak_songs': return (ctx.weakCount || 0) > 2;
            case 'gig_within_2_days': return ctx.daysToGig >= 0 && ctx.daysToGig <= 2;
            case 'just_finished_rehearsal': return ctx.justFinishedRehearsal;
            case 'no_rehearsal_this_week': return ctx.rehearsalsThisWeek === 0 && (ctx.songCount || 0) >= 5;
            case 'scorecard_has_issues': return ctx.topIssue && ctx.topIssue.length > 0;
            case 'sessions_running_long': return ctx.sessionsRunningLong;
            case 'trend_improving': return ctx.trend === 'improving';
            case 'practiced_but_weak_remain': return ctx.practicedToday && (ctx.weakCount || 0) > 0;
            case 'recent_session_no_mixdown': return ctx.recentSessionNoMixdown;
            default: return false;
        }
    }

    function _template(str, ctx) {
        return str.replace(/\{weakCount\}/g, ctx.weakCount || 0)
                  .replace(/\{daysOut\}/g, ctx.daysToGig || '?')
                  .replace(/\{s\}/g, (ctx.daysToGig || 0) !== 1 ? 's' : '')
                  .replace(/\{topIssue\}/g, ctx.topIssue || '');
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    function markShown(tipId) {
        _cooldowns[tipId] = Date.now();
        _saveState();
        // Mark one-time flags
        if (tipId === 'welcome') localStorage.setItem('gl_avatar_welcomed', '1');
        if (tipId === 'first_songs_added') localStorage.setItem('gl_avatar_first_songs', '1');
        if (tipId === 'first_practice_done') localStorage.setItem('gl_avatar_first_practice', '1');
    }

    function dismiss(tipId, permanent) {
        if (permanent) _dismissed[tipId] = 'permanent';
        _cooldowns[tipId] = Date.now();
        _saveState();
    }

    function snooze(tipId, hours) {
        _cooldowns[tipId] = Date.now() + (hours || 4) * 3600000 - (hours || 4) * 3600000; // just set cooldown
        _saveState();
    }

    function resetAll() {
        _dismissed = {};
        _cooldowns = {};
        localStorage.removeItem(_STORAGE_KEY);
        localStorage.removeItem('gl_avatar_welcomed');
        localStorage.removeItem('gl_avatar_first_songs');
        localStorage.removeItem('gl_avatar_first_practice');
    }

    // ── Context Builder ──────────────────────────────────────────────────────
    // Builds context from existing GrooveLinx data — no new data sources needed.

    function buildContext(page) {
        var ctx = { page: page || 'home' };

        // Songs
        ctx.songCount = (typeof allSongs !== 'undefined') ? allSongs.length : 0;

        // Setlists
        try {
            var sl = (typeof GLStore !== 'undefined' && GLStore.setlistCache) ? GLStore.setlistCache : (window._cachedSetlists || []);
            ctx.setlistCount = Array.isArray(sl) ? sl.length : 0;
        } catch(e) { ctx.setlistCount = 0; }

        // Weak songs
        try {
            if (typeof _countWeakSongs === 'function' && typeof _homeBundle !== 'undefined' && _homeBundle) {
                ctx.weakCount = _countWeakSongs(_homeBundle);
            } else { ctx.weakCount = 0; }
        } catch(e) { ctx.weakCount = 0; }

        // Practiced today
        try {
            var log = JSON.parse(localStorage.getItem('gl_action_log') || '{}');
            var today = new Date().toISOString().split('T')[0];
            var todayActions = log[today] || [];
            ctx.practicedToday = todayActions.some(function(a) { return a.type === 'practice_set' || a.type === 'practice_all'; });
            ctx.justCompletedPractice = todayActions.some(function(a) { return a.type && a.type.indexOf('completed_') === 0; });
        } catch(e) { ctx.practicedToday = false; ctx.justCompletedPractice = false; }

        // Gig timing
        try {
            if (typeof _homeBundle !== 'undefined' && _homeBundle && _homeBundle.gigs && _homeBundle.gigs[0]) {
                var gig = _homeBundle.gigs[0];
                var todayStr = new Date().toISOString().split('T')[0];
                ctx.daysToGig = Math.round((new Date(gig.date) - new Date(todayStr)) / 86400000);
            } else { ctx.daysToGig = 999; }
        } catch(e) { ctx.daysToGig = 999; }

        // Rehearsal data
        try {
            if (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache) {
                var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
                ctx.rehearsalsThisWeek = _rhSessionsCache.filter(function(s) { return (s.date || '') >= weekAgo; }).length;
                var recent = _rhSessionsCache[0];
                ctx.justFinishedRehearsal = recent && (Date.now() - new Date(recent.date).getTime()) < 3600000;
                ctx.recentSessionNoMixdown = recent && !recent.mixdown_id && (Date.now() - new Date(recent.date).getTime()) < 86400000;
                // Sessions running long
                var overCount = _rhSessionsCache.slice(0, 5).filter(function(s) { return s.totalBudgetMin && (s.totalActualMin || 0) - s.totalBudgetMin > 10; }).length;
                ctx.sessionsRunningLong = overCount >= 2;
                // Trend
                var rated = _rhSessionsCache.filter(function(s) { return s.rating; }).slice(0, 5);
                if (rated.length >= 2) {
                    var rv = { great: 3, solid: 2, needs_work: 1 };
                    var rh = rated.slice(0, Math.ceil(rated.length / 2));
                    var oh = rated.slice(Math.ceil(rated.length / 2));
                    var ra = rh.reduce(function(s, r) { return s + (rv[r.rating] || 0); }, 0) / rh.length;
                    var oa = oh.reduce(function(s, r) { return s + (rv[r.rating] || 0); }, 0) / oh.length;
                    ctx.trend = ra > oa + 0.3 ? 'improving' : ra < oa - 0.3 ? 'declining' : 'steady';
                }
            }
        } catch(e) {}

        // Scorecard top issue
        try {
            if (typeof _computeScorecard === 'function' && typeof _homeBundle !== 'undefined' && _homeBundle) {
                var sc = _computeScorecard(_homeBundle);
                ctx.topIssue = sc && sc.topFocus ? sc.topFocus : '';
            }
        } catch(e) { ctx.topIssue = ''; }

        return ctx;
    }

    // ── Intent Layer ────────────────────────────────────────────────────────
    // Maps user state to a single intent — simplifies all downstream logic.

    var INTENT = { SETUP: 'setup', FIRST_RUN: 'first_run', IMPROVE: 'improve', PREPARE: 'prepare', REHEARSE: 'rehearse', IDLE: 'idle' };

    function getIntent(ctx) {
        if (!ctx) ctx = buildContext();
        if ((ctx.songCount || 0) < 3) return INTENT.SETUP;
        if (!localStorage.getItem('gl_avatar_first_practice')) return INTENT.FIRST_RUN;
        if (ctx.daysToGig >= 0 && ctx.daysToGig <= 2) return INTENT.PREPARE;
        if (ctx.justFinishedRehearsal) return INTENT.REHEARSE;
        if ((ctx.weakCount || 0) > 0 || !ctx.practicedToday) return INTENT.IMPROVE;
        return INTENT.IDLE;
    }

    // ── Next Best Action Engine ──────────────────────────────────────────────
    // Returns ONE primary action. No ambiguity.

    function getNextBestAction(ctx) {
        if (!ctx) ctx = buildContext();
        var intent = getIntent(ctx);

        if (intent === INTENT.SETUP) {
            return { intent: intent, message: 'Add a few songs to get started.', primaryAction: { label: 'Add Songs', onclick: "showPage('songs')" }, secondaryActions: [{ label: 'Import Starter Pack', onclick: 'showStarterPackImport()' }] };
        }
        if (intent === INTENT.FIRST_RUN) {
            return { intent: intent, message: 'Let\u2019s run one. Hit play.', primaryAction: { label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }, secondaryActions: [] };
        }
        if (intent === INTENT.PREPARE) {
            return { intent: intent, message: 'Gig in ' + (ctx.daysToGig || '?') + ' day' + ((ctx.daysToGig || 0) !== 1 ? 's' : '') + '. Run the set.', primaryAction: { label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('gig')" }, secondaryActions: [{ label: 'Go Live', onclick: "homeGoLive()" }] };
        }
        if (intent === INTENT.REHEARSE) {
            return { intent: intent, message: 'Good session. Log notes or attach the mixdown.', primaryAction: { label: 'Add Notes', onclick: "showPage('rehearsal')" }, secondaryActions: [] };
        }
        if (intent === INTENT.IMPROVE) {
            var wc = ctx.weakCount || 0;
            if (wc > 0) return { intent: intent, message: wc + ' song' + (wc > 1 ? 's' : '') + ' need reps.', primaryAction: { label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }, secondaryActions: [{ label: 'See Weak Songs', onclick: "showPage('home')" }] };
            return { intent: intent, message: 'Keep it tight \u2014 run the set.', primaryAction: { label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('gig')" }, secondaryActions: [] };
        }
        return { intent: intent, message: 'All good. Keep the rhythm going.', primaryAction: { label: '\u25B6 Run What Matters', onclick: "hdPlayBundle('focus')" }, secondaryActions: [] };
    }

    // ── Tip Suppression ─────────────────────────────────────────────────────
    // Max 2 tips per day. Enforced in evaluate().

    var _DAILY_TIP_KEY = 'gl_avatar_tips_today';

    function _getTipCountToday() {
        try {
            var raw = localStorage.getItem(_DAILY_TIP_KEY);
            if (!raw) return 0;
            var data = JSON.parse(raw);
            if (data.date !== new Date().toISOString().split('T')[0]) return 0;
            return data.count || 0;
        } catch(e) { return 0; }
    }

    function _incrementTipCount() {
        try {
            var today = new Date().toISOString().split('T')[0];
            var raw = localStorage.getItem(_DAILY_TIP_KEY);
            var data = raw ? JSON.parse(raw) : {};
            if (data.date !== today) data = { date: today, count: 0 };
            data.count++;
            localStorage.setItem(_DAILY_TIP_KEY, JSON.stringify(data));
        } catch(e) {}
    }

    // Patch evaluate to enforce daily limit
    var _origEvaluate = evaluate;
    evaluate = function(context) {
        if (_getTipCountToday() >= 2) return null; // max 2 tips per day
        var result = _origEvaluate(context);
        if (result) _incrementTipCount();
        return result;
    };

    // ── Auto-Launch Practice ─────────────────────────────────────────────────
    // When user reaches ≥3 songs for the first time, nudge toward play.

    function checkAutoLaunch() {
        if (localStorage.getItem('gl_avatar_autolaunch_done')) return;
        var songCount = (typeof allSongs !== 'undefined') ? allSongs.length : 0;
        if (songCount < 3) return;
        localStorage.setItem('gl_avatar_autolaunch_done', '1');
        localStorage.setItem('gl_avatar_first_play_ready', '1');

        // Navigate to Play dashboard if not already there, then show nudge
        if (typeof GLStore !== 'undefined' && GLStore.getProductMode && GLStore.getProductMode() !== 'play') {
            if (typeof GLStore.setProductMode === 'function') GLStore.setProductMode('play');
        }
        if (typeof showPage === 'function') showPage('home');

        // Show overlay nudge after brief delay for page render
        setTimeout(function() {
            if (typeof GLAvatarUI !== 'undefined' && GLAvatarUI._showAutoLaunchNudge) {
                GLAvatarUI._showAutoLaunchNudge();
            }
        }, 500);
    }

    // ── Magic Moment ─────────────────────────────────────────────────────────
    // After first playback, offer weak-song follow-up.

    function checkMagicMoment() {
        if (localStorage.getItem('gl_avatar_magic_done')) return null;
        if (!localStorage.getItem('gl_avatar_first_practice')) return null;
        localStorage.setItem('gl_avatar_magic_done', '1');

        // Find the weakest song for a specific callout
        var weakSong = '';
        try {
            if (typeof _getWeakSongs === 'function' && typeof _homeBundle !== 'undefined' && _homeBundle) {
                var weak = _getWeakSongs(_homeBundle, 1);
                if (weak.length) weakSong = weak[0].title;
            }
        } catch(e) {}

        var msg = 'That felt tighter already.';
        if (weakSong) {
            msg += '\n\n\u201C' + weakSong + '\u201D still needs reps \u2014 hit that next?';
        } else {
            msg += '\nLet me line up your weakest songs next.';
        }

        return {
            message: msg,
            weakSong: weakSong,
            primaryAction: { label: '\u25B6 Play Weak Songs', onclick: "hdPlayBundle('focus')" },
            secondaryActions: [{ label: 'Later', dismiss: true }]
        };
    }

    // ── Spotify UX Messages ──────────────────────────────────────────────────

    function getSpotifyMessage() {
        var SP = (typeof GLSpotifyPlayer !== 'undefined') ? GLSpotifyPlayer : null;
        if (!SP) return null;
        var state = SP.getState();
        if (state === 'READY') return { message: 'Spotify connected \u2014 full tracks available.', type: 'success' };
        if (state === 'REQUIRES_INTERACTION') return { message: 'Tap play to start Spotify on this device.', type: 'action' };
        if (state === 'UNAVAILABLE') return { message: 'Spotify SDK unavailable \u2014 using embed player.', type: 'info' };
        if (state === 'ERROR') return { message: 'Spotify issue: ' + (SP.getLastError() || 'unknown') + '. Using fallback.', type: 'warning' };
        return null;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        STAGE: STAGE,
        INTENT: INTENT,
        getStage: getStage,
        getIntent: getIntent,
        getNextBestAction: getNextBestAction,
        evaluate: evaluate,
        buildContext: buildContext,
        markShown: markShown,
        dismiss: dismiss,
        snooze: snooze,
        resetAll: resetAll,
        checkAutoLaunch: checkAutoLaunch,
        checkMagicMoment: checkMagicMoment,
        getSpotifyMessage: getSpotifyMessage,
        GUIDANCE: GUIDANCE
    };

})();

console.log('\uD83E\uDD16 gl-avatar-guide.js loaded');
