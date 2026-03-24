// ============================================================================
// js/core/feed-metrics.js — Lightweight Usage Instrumentation
//
// Tracks real-world behavior to identify friction. No external analytics.
// Writes daily rollups to Firebase at bandPath('metrics/{memberKey}/{date}').
// Session-level tracking via localStorage for time-to-action.
//
// DEPENDS ON: firebaseDB, bandPath, FeedActionState (all resolved at call time)
// LOAD ORDER: after feed-action-state.js
// ============================================================================

'use strict';

window.FeedMetrics = (function() {

    var _SESSION_KEY = 'gl_metrics_session';
    var _buffer = []; // in-memory event buffer, flushed periodically

    // ── Session State ───────────────────────────────────────────────────────

    function _getSession() {
        try {
            var raw = sessionStorage.getItem(_SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    }

    function _setSession(data) {
        try { sessionStorage.setItem(_SESSION_KEY, JSON.stringify(data)); } catch(e) {}
    }

    function _initSession() {
        var existing = _getSession();
        if (existing) return existing;
        var session = {
            startedAt: Date.now(),
            firstActionAt: null,
            feedVisits: 0,
            actionsThisSession: 0,
            createsThisSession: 0,
            quickAdds: 0,
            structuredAdds: 0,
            bouncedVisits: 0,  // feed visits with 0 actions
            targetedCreates: 0
        };
        _setSession(session);
        return session;
    }

    // ── Event Tracking ──────────────────────────────────────────────────────

    function trackEvent(eventType, data) {
        var session = _initSession();
        data = data || {};

        switch (eventType) {
            case 'feed_visit':
                session.feedVisits++;
                // Track if previous visit was a bounce (no actions between visits)
                if (session._lastVisitActions === 0 && session.feedVisits > 1) {
                    session.bouncedVisits++;
                }
                session._lastVisitActions = 0;
                break;

            case 'action_completed':
                session.actionsThisSession++;
                session._lastVisitActions = (session._lastVisitActions || 0) + 1;
                if (!session.firstActionAt) {
                    session.firstActionAt = Date.now();
                }
                break;

            case 'item_created':
                session.createsThisSession++;
                if (data.method === 'quick') session.quickAdds++;
                else session.structuredAdds++;
                if (data.targeted) session.targetedCreates++;
                break;
        }

        _setSession(session);
        _buffer.push({ event: eventType, ts: Date.now(), data: data });
    }

    // ── Daily Rollup (Firebase) ─────────────────────────────────────────────
    //
    // Writes a single daily summary per member. Merges with existing day data.
    // Shape: metrics/{memberKey}/{YYYY-MM-DD}
    //   { visits, actions, creates, quickAdds, structuredAdds,
    //     targetedCreates, bounces, avgTimeToAction }

    async function flushToFirebase() {
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!fas || !db || typeof bandPath !== 'function') return;

        var memberKey = fas.getMyMemberKey();
        if (!memberKey) return;

        var session = _getSession();
        if (!session || session.feedVisits === 0) return;

        var today = new Date().toISOString().substring(0, 10);
        var path = bandPath('metrics/' + memberKey + '/' + today);

        try {
            var snap = await db.ref(path).once('value');
            var existing = snap.val() || {};

            var timeToAction = null;
            if (session.firstActionAt && session.startedAt) {
                timeToAction = Math.round((session.firstActionAt - session.startedAt) / 1000);
            }

            var updated = {
                visits:           (existing.visits || 0) + session.feedVisits,
                actions:          (existing.actions || 0) + session.actionsThisSession,
                creates:          (existing.creates || 0) + session.createsThisSession,
                quickAdds:        (existing.quickAdds || 0) + session.quickAdds,
                structuredAdds:   (existing.structuredAdds || 0) + session.structuredAdds,
                targetedCreates:  (existing.targetedCreates || 0) + session.targetedCreates,
                bounces:          (existing.bounces || 0) + session.bouncedVisits,
                lastSeen:         new Date().toISOString()
            };

            // Rolling average time-to-action
            if (timeToAction !== null) {
                var prevAvg = existing.avgTimeToAction || 0;
                var prevCount = existing._ttaCount || 0;
                updated.avgTimeToAction = Math.round(((prevAvg * prevCount) + timeToAction) / (prevCount + 1));
                updated._ttaCount = prevCount + 1;
            } else {
                updated.avgTimeToAction = existing.avgTimeToAction || 0;
                updated._ttaCount = existing._ttaCount || 0;
            }

            await db.ref(path).set(updated);

            // Reset session counters after flush (keep session alive)
            session.feedVisits = 0;
            session.actionsThisSession = 0;
            session.createsThisSession = 0;
            session.quickAdds = 0;
            session.structuredAdds = 0;
            session.bouncedVisits = 0;
            session.targetedCreates = 0;
            _setSession(session);
        } catch(e) {
            console.warn('[Metrics] Flush failed:', e.message);
        }
    }

    // ── Simple Dashboard Query ──────────────────────────────────────────────
    //
    // Reads last N days of metrics for all members.
    // Returns: { memberKey: { visits, actions, creates, ... } }

    async function getWeekSummary() {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return null;

        var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var cutoff = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
        var results = {};

        for (var m = 0; m < members.length; m++) {
            var key = members[m].key;
            results[key] = { visits: 0, actions: 0, creates: 0, quickAdds: 0, structuredAdds: 0, targetedCreates: 0, bounces: 0, avgTimeToAction: 0, name: members[m].name };
            try {
                var snap = await db.ref(bandPath('metrics/' + key)).orderByKey().startAt(cutoff).once('value');
                var days = snap.val();
                if (days) {
                    Object.values(days).forEach(function(d) {
                        results[key].visits += d.visits || 0;
                        results[key].actions += d.actions || 0;
                        results[key].creates += d.creates || 0;
                        results[key].quickAdds += d.quickAdds || 0;
                        results[key].structuredAdds += d.structuredAdds || 0;
                        results[key].targetedCreates += d.targetedCreates || 0;
                        results[key].bounces += d.bounces || 0;
                    });
                }
            } catch(e) {}
        }

        return results;
    }

    // ── Auto-flush ──────────────────────────────────────────────────────────
    // Flush on visibility change (user leaving) and periodically

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') flushToFirebase();
    });

    // Flush every 5 minutes while active
    setInterval(flushToFirebase, 300000);

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        trackEvent: trackEvent,
        flushToFirebase: flushToFirebase,
        getWeekSummary: getWeekSummary,
        getSession: _getSession
    };

})();

console.log('\uD83D\uDCCA feed-metrics.js loaded');
