// ─────────────────────────────────────────────────────────────────────────────
// gl-rehearsal-session.js — Canonical ownership layer for rehearsal_sessions
//
// C2 Phase 1 (2026-05-13) introduced the wrapper. C2 Phase 2 (this build) added
// helpers for nested fields, recent queries, and explicit-slug access so the
// 19 deferred Firebase access sites can move through the chokepoint. See
// 02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md for the migration
// status by file:line.
//
// Single chokepoint for Firebase access to bands/{slug}/rehearsal_sessions/**.
// Same Firebase semantics, plus updatedAt/updatedBy stamping and defensive
// logging. No schema change. No behavior change beyond auto-stamping writes.
//
// API: GLStore.RehearsalSession.{
//   // Phase 1
//   loadAll, loadById,
//   create, update, setField, remove,
//   setCurrent, getCurrent, clearCurrent,
//   subscribe,
//   getStats,
//   // Phase 2 (new)
//   loadField, removeField, loadRecent,
//   loadForBand, setForBand
// }
//
// Phase 2 conventions:
//   • All existing methods accept an optional `opts.slug` to target an
//     explicit band rather than the current band. When opts.slug is omitted
//     the call uses bandPath() (current band) — Phase 1 behavior preserved.
//   • `loadField`/`setField`/`removeField` use Firebase's '/' nesting so a
//     fieldPath like 'comments/<id>' or 'label_overrides/<key>' works.
//   • `loadRecent(limit, opts)` runs an `orderByChild(opts.orderBy).
//     limitToLast(limit)` query. Default orderBy is 'date'. Falls back to
//     loadAll().slice(0, limit) when the index isn't usable.
//   • `loadForBand(slug, sessionId?)` and `setForBand(slug, sessionId, patch,
//     opts)` are thin slug-explicit wrappers.
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
    // and the GLRuntimeHealth overlay.
    var _stats = {
        // Phase 1
        reads: 0,
        writes: 0,
        removes: 0,
        subscribes: 0,
        unsubscribes: 0,
        duplicateSubscribeAttempts: 0,
        currentlyOwned: 0,
        // Phase 2
        loadFieldCalls: 0,
        setFieldCalls: 0,
        removeFieldCalls: 0,
        loadRecentCalls: 0,
        loadForBandCalls: 0,
        setForBandCalls: 0,
        errors: 0,
        lastError: null
    };

    function _db() {
        return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    }

    function _bp(suffix, opts) {
        // Build a Firebase ref path for rehearsal_sessions. Phase 2 adds
        // opts.slug for explicit-slug consumers (analysis-pipeline, insights).
        opts = opts || {};
        if (opts.slug) {
            return 'bands/' + opts.slug + '/rehearsal_sessions' + (suffix ? '/' + suffix : '');
        }
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

    function _recordError(label, e) {
        _stats.errors++;
        _stats.lastError = { at: Date.now(), where: label, message: (e && e.message) || String(e) };
    }

    // ── Reads ────────────────────────────────────────────────────────────

    async function loadAll(opts) {
        var db = _db();
        var path = _bp(null, opts);
        if (!db || !path) {
            // Demoted from console.warn 2026-05-17: this fires multiple times
            // during the Rehearsal page's initial render before Firebase
            // finishes its async init — pure boot race, the page re-renders
            // correctly once Firebase ready. Kept as debug so dev tooling
            // can still surface it on Verbose level for real diagnostics.
            console.debug(TAG, 'loadAll skipped — no firebaseDB or bandPath');
            return [];
        }
        _stats.reads++;
        try {
            var snap = await db.ref(path).once('value');
            var val = snap.val();
            if (!val) return [];
            var arr = Object.keys(val).map(function (k) {
                var s = val[k];
                s.sessionId = s.sessionId || k;
                return s;
            });
            arr.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
            return arr;
        } catch (e) {
            _recordError('loadAll', e);
            console.warn(TAG, 'loadAll failed:', e && e.message);
            return [];
        }
    }

    async function loadById(sessionId, opts) {
        var db = _db();
        var path = _bp(sessionId, opts);
        if (!db || !path || !sessionId) return null;
        _stats.reads++;
        try {
            var snap = await db.ref(path).once('value');
            var v = snap.val();
            if (v && !v.sessionId) v.sessionId = sessionId;
            return v;
        } catch (e) {
            _recordError('loadById', e);
            console.warn(TAG, 'loadById failed:', sessionId, e && e.message);
            return null;
        }
    }

    // Phase 2: nested-field read. fieldPath uses Firebase '/' nesting so
    //   loadField(sid, 'comments') → bands/X/rehearsal_sessions/<sid>/comments
    //   loadField(sid, 'comments/cmt_abc') → ...rehearsal_sessions/<sid>/comments/cmt_abc
    //   loadField(sid, 'label_overrides/123_456') → ...rehearsal_sessions/<sid>/label_overrides/123_456
    async function loadField(sessionId, fieldPath, opts) {
        var db = _db();
        if (!db || !sessionId || !fieldPath) return null;
        var path = _bp(sessionId + '/' + fieldPath, opts);
        if (!path) return null;
        _stats.loadFieldCalls++;
        _stats.reads++;
        try {
            var snap = await db.ref(path).once('value');
            return snap.val();
        } catch (e) {
            _recordError('loadField', e);
            console.warn(TAG, 'loadField failed:', sessionId, fieldPath, e && e.message);
            return null;
        }
    }

    // Phase 2: recent-N query. Default ordering is 'date' to match the
    // existing recording-analyzer.js behavior. 'startedAt' is the band-feed
    // ordering. Returns array of sessions with sessionId backfilled.
    async function loadRecent(limit, opts) {
        opts = opts || {};
        var db = _db();
        var path = _bp(null, opts);
        if (!db || !path) return [];
        var n = (typeof limit === 'number' && limit > 0) ? limit : 5;
        var orderBy = opts.orderBy || 'date';
        _stats.loadRecentCalls++;
        _stats.reads++;
        try {
            var snap = await db.ref(path).orderByChild(orderBy).limitToLast(n).once('value');
            var val = snap.val();
            if (!val) return [];
            var arr = Object.keys(val).map(function (k) {
                var s = val[k];
                s.sessionId = s.sessionId || k;
                return s;
            });
            // limitToLast() returns ascending; callers historically reverse
            // to get newest-first.
            arr.sort(function (a, b) {
                var av = a[orderBy] || '';
                var bv = b[orderBy] || '';
                return String(bv).localeCompare(String(av));
            });
            return arr;
        } catch (e) {
            _recordError('loadRecent', e);
            console.warn(TAG, 'loadRecent failed (orderBy=' + orderBy + '):', e && e.message);
            return [];
        }
    }

    // Phase 2: explicit-slug load.
    //   loadForBand(slug)                    → all sessions for that slug
    //   loadForBand(slug, sessionId)         → that one session
    async function loadForBand(slug, sessionId) {
        if (!slug) return sessionId ? null : [];
        _stats.loadForBandCalls++;
        if (sessionId) return loadById(sessionId, { slug: slug });
        return loadAll({ slug: slug });
    }

    // ── Writes ───────────────────────────────────────────────────────────

    async function create(sessionId, payload, opts) {
        var db = _db();
        var path = _bp(sessionId, opts);
        if (!db || !path || !sessionId) {
            console.warn(TAG, 'create skipped — bad args', { sessionId: sessionId, hasDb: !!db, hasPath: !!path });
            return;
        }
        _stats.writes++;
        var stamped = _stamp(Object.assign({}, payload || {}, { sessionId: sessionId }));
        try { await db.ref(path).set(stamped); }
        catch (e) { _recordError('create', e); throw e; }
    }

    async function update(sessionId, patch, opts) {
        var db = _db();
        var path = _bp(sessionId, opts);
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
        try { await db.ref(path).update(stamped); }
        catch (e) { _recordError('update', e); throw e; }
    }

    async function setField(sessionId, fieldPath, value, opts) {
        // Nested write helper. Stamps updatedAt/updatedBy on the PARENT session
        // record so the list sort and "what changed last" signals stay
        // consistent. fieldPath uses Firebase '/' nesting (see loadField).
        var db = _db();
        if (!db || !sessionId || !fieldPath) {
            console.warn(TAG, 'setField skipped — bad args');
            return;
        }
        var leafPath = _bp(sessionId + '/' + fieldPath, opts);
        if (!leafPath) return;
        _stats.setFieldCalls++;
        _stats.writes++;
        try {
            await db.ref(leafPath).set(value);
        } catch (e) {
            _recordError('setField', e);
            throw e;
        }
        try {
            // Best-effort parent stamp; don't fail the call if this errors.
            await db.ref(_bp(sessionId, opts)).update(_stamp({}));
        } catch (e) {
            console.debug(TAG, 'setField parent-stamp failed (non-fatal):', e && e.message);
        }
    }

    // Phase 2: nested-field removal. Same '/' nesting as setField.
    async function removeField(sessionId, fieldPath, opts) {
        var db = _db();
        if (!db || !sessionId || !fieldPath) {
            console.warn(TAG, 'removeField skipped — bad args');
            return;
        }
        var leafPath = _bp(sessionId + '/' + fieldPath, opts);
        if (!leafPath) return;
        _stats.removeFieldCalls++;
        _stats.removes++;
        try {
            await db.ref(leafPath).remove();
        } catch (e) {
            _recordError('removeField', e);
            throw e;
        }
        try {
            await db.ref(_bp(sessionId, opts)).update(_stamp({}));
        } catch (e) {
            console.debug(TAG, 'removeField parent-stamp failed (non-fatal):', e && e.message);
        }
    }

    async function remove(sessionId, opts) {
        var db = _db();
        var path = _bp(sessionId, opts);
        if (!db || !path || !sessionId) return;
        _stats.removes++;
        try {
            await db.ref(path).remove();
            if (_current && _current.sessionId === sessionId) clearCurrent();
        } catch (e) {
            _recordError('remove', e);
            console.warn(TAG, 'remove failed:', sessionId, e && e.message);
        }
    }

    // Phase 2: explicit-slug write. Thin wrapper.
    //   setForBand(slug, sid, patch)                  → update(sid, patch, {slug})
    //   setForBand(slug, sid, value, {fieldPath: 'analysis'}) → setField(sid, 'analysis', value, {slug})
    async function setForBand(slug, sessionId, patchOrValue, opts) {
        opts = opts || {};
        if (!slug || !sessionId) {
            console.warn(TAG, 'setForBand skipped — bad args', { slug: !!slug, sessionId: !!sessionId });
            return;
        }
        _stats.setForBandCalls++;
        if (opts.fieldPath) {
            return setField(sessionId, opts.fieldPath, patchOrValue, { slug: slug });
        }
        return update(sessionId, patchOrValue, { slug: slug });
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
        return Object.assign({}, _stats, {
            activeSubs: _activeSubs.length,
            activeSubscriptions: _activeSubs.length  // alias matching prompt naming
        });
    }

    // ── GLRouteLifecycle integration ─────────────────────────────────────
    //
    // Register a disposer for the 'rehearsal' route so any active Firebase
    // subscription is torn down and the in-memory current pointer is
    // cleared on navigation away.

    function _registerLifecycle() {
        if (typeof window === 'undefined') return;
        if (!window.GLRouteLifecycle || typeof window.GLRouteLifecycle.register !== 'function') {
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
            // Phase 1
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
            getStats:     getStats,
            // Phase 2
            loadField:    loadField,
            removeField:  removeField,
            loadRecent:   loadRecent,
            loadForBand:  loadForBand,
            setForBand:   setForBand
        };
        console.log(TAG, 'attached to GLStore (Phase 2 helpers live)');
        _registerLifecycle();
    }

    _attach();

    // Best-effort detach on unload — defense in depth alongside the route
    // lifecycle disposer.
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', _detachAllSubs);
    }
})();
