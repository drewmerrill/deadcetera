// ─────────────────────────────────────────────────────────────────────────────
// gl-rehearsal-session.js — Canonical ownership layer for rehearsal_sessions
//
// C2 Phase 1 (Reality Convergence Initiative — see
// 02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md).
//
// Single chokepoint for Firebase access to bands/{slug}/rehearsal_sessions/**.
// Phase 1 wraps the safest/highest-value paths (rehearsal.js + rehearsal-mode.js
// — 9 sites). Other callers (multitrack-rehearsal, recording-analyzer,
// rehearsal-analysis-pipeline, gl-insights, groovemate_tools, band-feed) still
// hit Firebase directly and will move in Phase 2. The wrapper is deliberately
// thin: same Firebase semantics, plus updatedAt/updatedBy stamping and
// defensive logging.
//
// API: GLStore.RehearsalSession.{
//   loadAll, loadById,
//   create, update, setField, remove,
//   setCurrent, getCurrent, clearCurrent,
//   subscribe,
//   getStats
// }
//
// EXPOSES: window.GLStore.RehearsalSession
// DEPENDS ON: window.GLStore, firebaseDB, bandPath, currentUserEmail
// LIFECYCLE: registers a 'rehearsal' route disposer with GLRouteLifecycle
//   when available, so navigating away clears in-memory current session and
//   detaches any active subscription.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    'use strict';

    var TAG = '[RehearsalSession]';

    // In-memory "what's the user currently looking at" pointer.
    var _current = null;          // { sessionId, session } | null
    var _activeSubs = [];          // [{ ref, handler }] — for .on() subscriptions (Phase 2 callers)

    // Lightweight defensive counters. Surfaced via getStats() for telemetry
    // and tests. Bump in production code — these are cheap.
    var _stats = {
        reads: 0,
        writes: 0,
        removes: 0,
        subscribes: 0,
        unsubscribes: 0,
        duplicateSubscribeAttempts: 0,
        currentlyOwned: 0
    };

    function _db() {
        return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    }

    function _bp(suffix) {
        if (typeof bandPath !== 'function') return null;
        return bandPath('rehearsal_sessions' + (suffix ? '/' + suffix : ''));
    }

    function _userEmail() {
        return (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : null;
    }

    function _stamp(patch) {
        // Mirrors saveBandArrayDataSafe's stamping. Only adds the fields if
        // the caller hasn't already provided them (don't clobber an explicit
        // updatedBy from groovemate_tools or similar).
        if (!patch || typeof patch !== 'object') return patch;
        if (patch.updatedAt == null) patch.updatedAt = Date.now();
        if (patch.updatedBy == null) {
            var who = _userEmail();
            if (who) patch.updatedBy = who;
        }
        return patch;
    }

    // ── Reads ────────────────────────────────────────────────────────────

    async function loadAll() {
        var db = _db();
        var path = _bp();
        if (!db || !path) {
            console.warn(TAG, 'loadAll skipped — no firebaseDB or bandPath');
            return [];
        }
        _stats.reads++;
        try {
            var snap = await db.ref(path).once('value');
            var val = snap.val();
            if (!val) return [];
            // Same shape rehearsal.js _rhLoadSessions emitted: array w/ sessionId
            // backfilled from key. Sort newest-first by date so callers get the
            // same ordering they had before the wrap.
            var arr = Object.keys(val).map(function (k) {
                var s = val[k];
                s.sessionId = s.sessionId || k;
                return s;
            });
            arr.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
            return arr;
        } catch (e) {
            console.warn(TAG, 'loadAll failed:', e && e.message);
            return [];
        }
    }

    async function loadById(sessionId) {
        var db = _db();
        var path = _bp(sessionId);
        if (!db || !path || !sessionId) return null;
        _stats.reads++;
        try {
            var snap = await db.ref(path).once('value');
            var v = snap.val();
            if (v && !v.sessionId) v.sessionId = sessionId;
            return v;
        } catch (e) {
            console.warn(TAG, 'loadById failed:', sessionId, e && e.message);
            return null;
        }
    }

    // ── Writes ───────────────────────────────────────────────────────────

    async function create(sessionId, payload) {
        var db = _db();
        var path = _bp(sessionId);
        if (!db || !path || !sessionId) {
            console.warn(TAG, 'create skipped — bad args', { sessionId: sessionId, hasDb: !!db, hasPath: !!path });
            return;
        }
        _stats.writes++;
        var stamped = _stamp(Object.assign({}, payload || {}, { sessionId: sessionId }));
        await db.ref(path).set(stamped);
    }

    async function update(sessionId, patch) {
        var db = _db();
        var path = _bp(sessionId);
        if (!db || !path || !sessionId) {
            console.warn(TAG, 'update skipped — bad args', { sessionId: sessionId });
            return;
        }
        if (!patch || typeof patch !== 'object' || !Object.keys(patch).length) {
            // No-op update — preserve old behavior of "skip when patch is empty"
            return;
        }
        _stats.writes++;
        var stamped = _stamp(Object.assign({}, patch));
        await db.ref(path).update(stamped);
    }

    async function setField(sessionId, fieldPath, value) {
        // Nested write helper for known sub-paths (e.g. 'audio_segments').
        // Stamps updatedAt/updatedBy on the PARENT session record so the list
        // sort and "what changed last" signals stay consistent.
        var db = _db();
        if (!db || !sessionId || !fieldPath) {
            console.warn(TAG, 'setField skipped — bad args');
            return;
        }
        var leafPath = _bp(sessionId + '/' + fieldPath);
        if (!leafPath) return;
        _stats.writes++;
        await db.ref(leafPath).set(value);
        try {
            // Best-effort parent stamp; don't fail the call if this errors.
            await db.ref(_bp(sessionId)).update(_stamp({}));
        } catch (e) {
            console.debug(TAG, 'setField parent-stamp failed (non-fatal):', e && e.message);
        }
    }

    async function remove(sessionId) {
        var db = _db();
        var path = _bp(sessionId);
        if (!db || !path || !sessionId) return;
        _stats.removes++;
        try {
            await db.ref(path).remove();
            if (_current && _current.sessionId === sessionId) clearCurrent();
        } catch (e) {
            console.warn(TAG, 'remove failed:', sessionId, e && e.message);
        }
    }

    // ── In-memory current-session pointer ────────────────────────────────

    function setCurrent(sessionId, sessionData) {
        _current = { sessionId: sessionId, session: sessionData || null };
        _stats.currentlyOwned = 1;
    }

    function getCurrent() {
        return _current;
    }

    function clearCurrent() {
        _current = null;
        _stats.currentlyOwned = 0;
    }

    // ── Subscriptions (Phase 2 surface; no callers in Phase 1) ───────────
    //
    // Returns an unsubscribe fn. Pattern matches gl-leader's
    // _syncAttachListener / _syncDetachListener so duplicate-subscribe is
    // detected and the previous subscription is detached first.

    function subscribe(handler) {
        if (typeof handler !== 'function') return function () {};
        var db = _db();
        var path = _bp();
        if (!db || !path) return function () {};

        // Detect duplicate attempts — same handler ref subscribing twice
        for (var i = 0; i < _activeSubs.length; i++) {
            if (_activeSubs[i].handler === handler) {
                _stats.duplicateSubscribeAttempts++;
                console.warn(TAG, 'subscribe: duplicate handler — returning existing unsub');
                var existing = _activeSubs[i];
                return function () {
                    try { existing.ref.off('value', existing.handler); } catch (e) {}
                    _activeSubs = _activeSubs.filter(function (s) { return s !== existing; });
                    _stats.unsubscribes++;
                };
            }
        }

        var ref = db.ref(path);
        ref.on('value', handler);
        var rec = { ref: ref, handler: handler };
        _activeSubs.push(rec);
        _stats.subscribes++;

        return function () {
            try { ref.off('value', handler); } catch (e) {}
            _activeSubs = _activeSubs.filter(function (s) { return s !== rec; });
            _stats.unsubscribes++;
        };
    }

    function _detachAllSubs() {
        // Called by route-lifecycle disposer or unload.
        _activeSubs.forEach(function (s) {
            try { s.ref.off('value', s.handler); } catch (e) {}
            _stats.unsubscribes++;
        });
        _activeSubs = [];
    }

    // ── Telemetry ────────────────────────────────────────────────────────

    function getStats() {
        return Object.assign({}, _stats, { activeSubs: _activeSubs.length });
    }

    // ── GLRouteLifecycle integration ─────────────────────────────────────
    //
    // Register a disposer for the 'rehearsal' route so any active Firebase
    // subscription is torn down and the in-memory current pointer is
    // cleared on navigation away. Phase 1 has no actual subscribers, but
    // wiring this now means Phase 2 callers get cleanup "for free" by going
    // through subscribe().

    function _registerLifecycle() {
        if (typeof window === 'undefined') return;
        if (!window.GLRouteLifecycle || typeof window.GLRouteLifecycle.register !== 'function') {
            // Lifecycle module not loaded yet — try again next tick.
            setTimeout(_registerLifecycle, 0);
            return;
        }
        window.GLRouteLifecycle.register('rehearsal', function () {
            _detachAllSubs();
            // Note: we do NOT clear _current on route-leave by default —
            // viewing a session report and then bouncing through another
            // page should keep the pointer. Use clearCurrent() explicitly.
        });
    }

    // ── Attach to GLStore ────────────────────────────────────────────────

    function _attach() {
        if (typeof window === 'undefined') return;
        if (typeof window.GLStore === 'undefined') {
            setTimeout(_attach, 0);
            return;
        }
        window.GLStore.RehearsalSession = {
            loadAll:      loadAll,
            loadById:     loadById,
            create:       create,
            update:       update,
            setField:     setField,
            remove:       remove,
            setCurrent:   setCurrent,
            getCurrent:   getCurrent,
            clearCurrent: clearCurrent,
            subscribe:    subscribe,
            getStats:     getStats
        };
        console.log(TAG, 'attached to GLStore');
        _registerLifecycle();
    }

    _attach();

    // Best-effort detach on unload — defense in depth alongside the route
    // lifecycle disposer.
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', _detachAllSubs);
    }
})();
