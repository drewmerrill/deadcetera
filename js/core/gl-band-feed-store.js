// ─────────────────────────────────────────────────────────────────────────────
// gl-band-feed-store.js — Canonical ownership layer for band feed data
//
// C5 Phase 1 (Reality Convergence Initiative). Single chokepoint for Firebase
// access to:
//   bands/{slug}/ideas/posts/**     — posts / ideas / notes / links / photos
//   bands/{slug}/polls/**           — polls
//   bands/{slug}/polls/{id}/votes/* — votes
//   bands/{slug}/feed_meta/**       — resolved / archived / tag / notes
//
// Pattern matches gl-rehearsal-session.js (C2). Same Firebase semantics, plus:
//   • updatedAt/updatedBy stamping on writes (where not caller-provided)
//   • subscription tracking (so `teardown()` can detach everything)
//   • opts.slug for explicit-band access
//   • lightweight runtime stats surfaced via getStats() / Runtime Health Overlay
//
// API: GLBandFeedStore.{
//   loadFeed, loadPosts, loadPolls, loadLatest, loadFeedMeta,
//   createPost, updatePost, removePost,
//   createPoll, updatePoll, removePoll, votePoll,
//   setFeedMeta, removeFeedMeta,
//   subscribe, unsubscribe, teardown,
//   getStats
// }
//
// EXPOSES: window.GLBandFeedStore
// DEPENDS ON: firebaseDB, bandPath, currentUserEmail
// LIFECYCLE: registers a 'feed' route disposer that calls teardown()
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    'use strict';

    var TAG = '[BandFeedStore]';

    // Subscription registry: each entry { id, type, ref, event, handler }
    var _subs = {};
    var _subId = 0;

    var _stats = {
        // Reads
        loadFeedCalls: 0,
        loadPostsCalls: 0,
        loadPollsCalls: 0,
        loadLatestCalls: 0,
        loadFeedMetaCalls: 0,
        // Writes
        createPostCalls: 0,
        updatePostCalls: 0,
        removePostCalls: 0,
        createPollCalls: 0,
        updatePollCalls: 0,
        removePollCalls: 0,
        votePollCalls: 0,
        setFeedMetaCalls: 0,
        removeFeedMetaCalls: 0,
        // Subscriptions
        subscribeCalls: 0,
        unsubscribeCalls: 0,
        duplicateSubscribeAttempts: 0,
        // Lightweight live counters / runtime signals
        activeSubscriptions: 0,
        activePollsListeners: 0,
        activeIdeasListeners: 0,
        pollingLoops: 0,        // bumped when bg-badge-refresh-style consumers call us
        lastRealtimeEventAt: null,
        lastWriteAt: null,
        cleanupFailures: 0,
        // Error tail
        errors: 0,
        lastError: null
    };

    function _db() {
        return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    }

    function _bp(suffix, opts) {
        opts = opts || {};
        if (opts.slug) {
            return 'bands/' + opts.slug + (suffix ? '/' + suffix : '');
        }
        if (typeof bandPath !== 'function') return null;
        return bandPath(suffix || '');
    }

    function _userEmail() {
        return (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : null;
    }

    function _stamp(patch, opts) {
        // Stamps updatedAt/updatedBy only if caller didn't provide. opts.skipStamp
        // suppresses for paths where the field shape would change (votes maps,
        // for example).
        if (!patch || typeof patch !== 'object') return patch;
        if (opts && opts.skipStamp) return patch;
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

    function _arrFromVal(val, idField) {
        // Convert Firebase keyed object to array with id field backfilled.
        if (!val) return [];
        return Object.keys(val).map(function (k) {
            var v = val[k] || {};
            if (idField && !v[idField]) v[idField] = k;
            if (!v.id) v.id = k;
            return v;
        });
    }

    function _sortByTs(arr, dir) {
        // Newest-first by default.
        var d = dir === 'asc' ? 1 : -1;
        arr.sort(function (a, b) {
            var at = a && a.ts || '';
            var bt = b && b.ts || '';
            return d * String(bt).localeCompare(String(at));
        });
        return arr;
    }

    // ── Reads ────────────────────────────────────────────────────────────

    async function loadPosts(limit, opts) {
        var db = _db();
        var path = _bp('ideas/posts', opts);
        if (!db || !path) return [];
        _stats.loadPostsCalls++;
        try {
            var ref = db.ref(path).orderByChild('ts');
            if (limit && typeof limit === 'number') ref = ref.limitToLast(limit);
            var snap = await ref.once('value');
            return _sortByTs(_arrFromVal(snap.val()));
        } catch (e) {
            _recordError('loadPosts', e);
            console.warn(TAG, 'loadPosts failed:', e && e.message);
            return [];
        }
    }

    async function loadPolls(limit, opts) {
        var db = _db();
        var path = _bp('polls', opts);
        if (!db || !path) return [];
        _stats.loadPollsCalls++;
        // Convenience: callers passing only {pollingLoop: true} for bg-badge use
        // bump the pollingLoops counter so the overlay can see ongoing badge polls.
        if (opts && opts.pollingLoop) _stats.pollingLoops++;
        try {
            var ref = db.ref(path).orderByChild('ts');
            if (limit && typeof limit === 'number') ref = ref.limitToLast(limit);
            var snap = await ref.once('value');
            return _sortByTs(_arrFromVal(snap.val()));
        } catch (e) {
            _recordError('loadPolls', e);
            console.warn(TAG, 'loadPolls failed:', e && e.message);
            return [];
        }
    }

    async function loadFeed(limit, opts) {
        // Returns combined posts+polls array sorted by ts (newest-first).
        // Pass-through to underlying loaders for the simplest possible merge.
        // Each caller still gets its own typed flag (`type: 'idea'|'poll'`).
        _stats.loadFeedCalls++;
        var n = (typeof limit === 'number' && limit > 0) ? limit : 50;
        var posts = await loadPosts(n, opts);
        var polls = await loadPolls(n, opts);
        posts.forEach(function (p) { p.type = p.type || 'idea'; });
        polls.forEach(function (p) { p.type = p.type || 'poll'; });
        var combined = posts.concat(polls);
        _sortByTs(combined);
        return combined.slice(0, n);
    }

    async function loadLatest(type, opts) {
        // type: 'post'|'idea'|'poll'|undefined (=any)
        _stats.loadLatestCalls++;
        if (type === 'poll') {
            var p = await loadPolls(1, opts);
            return p[0] || null;
        }
        if (type === 'post' || type === 'idea') {
            var i = await loadPosts(1, opts);
            return i[0] || null;
        }
        var arr = await loadFeed(1, opts);
        return arr[0] || null;
    }

    async function loadFeedMeta(opts) {
        var db = _db();
        var path = _bp('feed_meta', opts);
        if (!db || !path) return {};
        _stats.loadFeedMetaCalls++;
        try {
            var snap = await db.ref(path).once('value');
            return snap.val() || {};
        } catch (e) {
            _recordError('loadFeedMeta', e);
            console.warn(TAG, 'loadFeedMeta failed:', e && e.message);
            return {};
        }
    }

    // ── Writes ───────────────────────────────────────────────────────────

    async function createPost(payload, opts) {
        var db = _db();
        var path = _bp('ideas/posts', opts);
        if (!db || !path || !payload) {
            console.warn(TAG, 'createPost skipped — bad args');
            return null;
        }
        _stats.createPostCalls++;
        _stats.lastWriteAt = Date.now();
        var stamped = _stamp(Object.assign({}, payload));
        try {
            var ref = await db.ref(path).push(stamped);
            return ref && ref.key ? ref.key : null;
        } catch (e) {
            _recordError('createPost', e);
            throw e;
        }
    }

    async function updatePost(id, patch, opts) {
        var db = _db();
        var path = _bp('ideas/posts/' + id, opts);
        if (!db || !path || !id || !patch || typeof patch !== 'object') return;
        _stats.updatePostCalls++;
        _stats.lastWriteAt = Date.now();
        var stamped = _stamp(Object.assign({}, patch));
        try { await db.ref(path).update(stamped); }
        catch (e) { _recordError('updatePost', e); throw e; }
    }

    async function removePost(id, opts) {
        var db = _db();
        var path = _bp('ideas/posts/' + id, opts);
        if (!db || !path || !id) return;
        _stats.removePostCalls++;
        _stats.lastWriteAt = Date.now();
        try { await db.ref(path).remove(); }
        catch (e) { _recordError('removePost', e); }
    }

    async function createPoll(payload, opts) {
        var db = _db();
        var path = _bp('polls', opts);
        if (!db || !path || !payload) {
            console.warn(TAG, 'createPoll skipped — bad args');
            return null;
        }
        _stats.createPollCalls++;
        _stats.lastWriteAt = Date.now();
        var stamped = _stamp(Object.assign({}, payload));
        try {
            var ref = await db.ref(path).push(stamped);
            return ref && ref.key ? ref.key : null;
        } catch (e) {
            _recordError('createPoll', e);
            throw e;
        }
    }

    async function updatePoll(id, patch, opts) {
        var db = _db();
        var path = _bp('polls/' + id, opts);
        if (!db || !path || !id || !patch || typeof patch !== 'object') return;
        _stats.updatePollCalls++;
        _stats.lastWriteAt = Date.now();
        var stamped = _stamp(Object.assign({}, patch));
        try { await db.ref(path).update(stamped); }
        catch (e) { _recordError('updatePoll', e); throw e; }
    }

    async function removePoll(id, opts) {
        var db = _db();
        var path = _bp('polls/' + id, opts);
        if (!db || !path || !id) return;
        _stats.removePollCalls++;
        _stats.lastWriteAt = Date.now();
        try { await db.ref(path).remove(); }
        catch (e) { _recordError('removePoll', e); }
    }

    async function votePoll(pollId, voteData, opts) {
        // voteData: { voteKey, optionIdx } — voteKey is the user identifier
        // (typically email or member id). optionIdx is the option chosen.
        // The vote path bands/{slug}/polls/{id}/votes/{voteKey} = optionIdx.
        // We deliberately do NOT stamp the parent (votes map shape is fragile).
        var db = _db();
        if (!db || !pollId || !voteData || !voteData.voteKey) {
            console.warn(TAG, 'votePoll skipped — bad args');
            return;
        }
        var path = _bp('polls/' + pollId + '/votes/' + voteData.voteKey, opts);
        if (!path) return;
        _stats.votePollCalls++;
        _stats.lastWriteAt = Date.now();
        try {
            await db.ref(path).set(voteData.optionIdx);
        } catch (e) {
            _recordError('votePoll', e);
            throw e;
        }
    }

    async function setFeedMeta(key, patch, opts) {
        var db = _db();
        var path = _bp('feed_meta/' + key, opts);
        if (!db || !path || !key || !patch || typeof patch !== 'object') return;
        _stats.setFeedMetaCalls++;
        _stats.lastWriteAt = Date.now();
        try { await db.ref(path).update(patch); }
        catch (e) { _recordError('setFeedMeta', e); throw e; }
    }

    async function removeFeedMeta(key, opts) {
        var db = _db();
        var path = _bp('feed_meta/' + key, opts);
        if (!db || !path || !key) return;
        _stats.removeFeedMetaCalls++;
        _stats.lastWriteAt = Date.now();
        try { await db.ref(path).remove(); }
        catch (e) { _recordError('removeFeedMeta', e); }
    }

    // ── Subscriptions ───────────────────────────────────────────────────

    // type: 'poll-new' | 'idea-new' | 'polls-all' | 'ideas-all' | 'feed-meta'
    // callback: (snapOrVal, key?) => void
    // returns subscription id (string)
    function subscribe(type, callback, opts) {
        if (typeof callback !== 'function' || !type) return null;
        var db = _db();
        if (!db) return null;

        // De-dupe: same type+callback returns existing sub id.
        var existingId = null;
        Object.keys(_subs).forEach(function (sid) {
            var s = _subs[sid];
            if (s && s.type === type && s.handler === callback) existingId = sid;
        });
        if (existingId !== null) {
            _stats.duplicateSubscribeAttempts++;
            return existingId;
        }

        var ref = null;
        var event = 'value';
        var path;

        if (type === 'poll-new') {
            path = _bp('polls', opts);
            if (!path) return null;
            ref = db.ref(path).orderByChild('ts').limitToLast(1);
            event = 'child_added';
        } else if (type === 'idea-new') {
            path = _bp('ideas/posts', opts);
            if (!path) return null;
            ref = db.ref(path).orderByChild('ts').limitToLast(1);
            event = 'child_added';
        } else if (type === 'polls-all') {
            path = _bp('polls', opts);
            if (!path) return null;
            ref = db.ref(path);
            event = 'value';
        } else if (type === 'ideas-all') {
            path = _bp('ideas/posts', opts);
            if (!path) return null;
            ref = db.ref(path);
            event = 'value';
        } else if (type === 'feed-meta') {
            path = _bp('feed_meta', opts);
            if (!path) return null;
            ref = db.ref(path);
            event = 'value';
        } else {
            console.warn(TAG, 'subscribe: unknown type', type);
            return null;
        }

        var handlerWrapper = function (snap) {
            _stats.lastRealtimeEventAt = Date.now();
            try { callback(snap); }
            catch (e) {
                _stats.cleanupFailures++;
                _recordError('subscribe-handler:' + type, e);
            }
        };

        try { ref.on(event, handlerWrapper); }
        catch (e) { _recordError('subscribe', e); return null; }

        var id = 'fs_' + (++_subId);
        _subs[id] = { id: id, type: type, ref: ref, event: event, handler: callback, wrapper: handlerWrapper };
        _stats.subscribeCalls++;
        _stats.activeSubscriptions = Object.keys(_subs).length;
        if (type === 'poll-new' || type === 'polls-all') _stats.activePollsListeners++;
        if (type === 'idea-new' || type === 'ideas-all') _stats.activeIdeasListeners++;
        return id;
    }

    function unsubscribe(subscriptionId) {
        var s = _subs[subscriptionId];
        if (!s) return false;
        try { s.ref.off(s.event, s.wrapper); }
        catch (e) {
            _stats.cleanupFailures++;
            _recordError('unsubscribe', e);
        }
        delete _subs[subscriptionId];
        _stats.unsubscribeCalls++;
        _stats.activeSubscriptions = Object.keys(_subs).length;
        if (s.type === 'poll-new' || s.type === 'polls-all') {
            _stats.activePollsListeners = Math.max(0, _stats.activePollsListeners - 1);
        }
        if (s.type === 'idea-new' || s.type === 'ideas-all') {
            _stats.activeIdeasListeners = Math.max(0, _stats.activeIdeasListeners - 1);
        }
        return true;
    }

    function teardown() {
        Object.keys(_subs).forEach(function (sid) { unsubscribe(sid); });
        _subs = {};
        _stats.activeSubscriptions = 0;
        _stats.activePollsListeners = 0;
        _stats.activeIdeasListeners = 0;
    }

    // ── Telemetry ────────────────────────────────────────────────────────

    function getStats() {
        return Object.assign({}, _stats, {
            subscriptionCount: Object.keys(_subs).length,
            subscriptionIds: Object.keys(_subs)
        });
    }

    // ── GLRouteLifecycle integration ─────────────────────────────────────
    //
    // Register a disposer for the 'feed' route. NOTE: existing realtime
    // listeners in band-feed.js (`_feedRealtimeNotifs` at line ~2317) are
    // session-wide by design — they fire local notifications even when the
    // user isn't on the feed page. Those listeners do NOT go through this
    // store yet; they keep their own teardown via window._feedRealtimeTeardown.
    // This route disposer only cleans up subs that THIS store owns.

    function _registerLifecycle() {
        if (typeof window === 'undefined') return;
        if (!window.GLRouteLifecycle || typeof window.GLRouteLifecycle.register !== 'function') {
            setTimeout(_registerLifecycle, 0);
            return;
        }
        window.GLRouteLifecycle.register('feed', function () {
            // Conservative: only detach 'feed-meta' / 'polls-all' / 'ideas-all'
            // page-scoped subs on route leave. Notification-driven 'poll-new' /
            // 'idea-new' subs are session-wide and stay attached.
            Object.keys(_subs).forEach(function (sid) {
                var s = _subs[sid];
                if (!s) return;
                if (s.type === 'feed-meta' || s.type === 'polls-all' || s.type === 'ideas-all') {
                    unsubscribe(sid);
                }
            });
        });
    }

    // ── Attach to window ────────────────────────────────────────────────

    function _attach() {
        if (typeof window === 'undefined') return;
        window.GLBandFeedStore = {
            // Reads
            loadFeed:        loadFeed,
            loadPosts:       loadPosts,
            loadPolls:       loadPolls,
            loadLatest:      loadLatest,
            loadFeedMeta:    loadFeedMeta,
            // Writes
            createPost:      createPost,
            updatePost:      updatePost,
            removePost:      removePost,
            createPoll:      createPoll,
            updatePoll:      updatePoll,
            removePoll:      removePoll,
            votePoll:        votePoll,
            setFeedMeta:     setFeedMeta,
            removeFeedMeta:  removeFeedMeta,
            // Subscriptions
            subscribe:       subscribe,
            unsubscribe:     unsubscribe,
            teardown:        teardown,
            // Telemetry
            getStats:        getStats
        };
        console.log(TAG, 'attached to window');
        _registerLifecycle();
    }

    _attach();

    // Best-effort teardown on unload.
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', teardown);
    }
})();
