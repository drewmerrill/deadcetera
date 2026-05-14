// ============================================================================
// js/core/gl-player-contract.js — Unified PlayerEngine Contract (Phase C.1)
//
// Defines the canonical method names, event names, state names, capability
// names, and intent names that any conforming player engine must expose.
//
// Spec lives at: 02_GrooveLinx/specs/player_engine_contract.md
//
// C.1 (THIS BUILD): contract definition + capability matrix + registry.
// No engine wraps yet. C.2 wraps GLPlayerEngine, C.3 extracts/wraps the
// Stems mixer out of song-detail.js, C.4 wraps SetlistPlayer.
//
// PURELY ADDITIVE — this module touches no existing engine and has no
// consumers yet. Every existing call site keeps working identically.
//
// SYSTEM LOCKs preserved (CLAUDE.md §7): _navSeq, focusChanged, Firebase
// error filter, ACTIVE_STATUSES — all untouched.
// ============================================================================

'use strict';

window.GLPlayerContract = (function () {

    // ── CAPABILITIES ────────────────────────────────────────────────────────
    // Every conforming engine declares its capabilities array. Consumers
    // call engine.has(CAPABILITY) before invoking capability-specific
    // methods. See spec §3.3 for the surface area each capability requires.

    var CAPABILITIES = Object.freeze({
        // Required for every engine
        QUEUE:               'queue',
        PLAYBACK:            'playback',
        STATE:               'state',
        EVENTS:              'events',

        // Optional — opted into per engine
        SEEK:                'seek',
        VOLUME:              'volume',
        TEMPO:               'tempo',
        PITCH:               'pitch',
        LOOP:                'loop',
        STEMS:               'stems',
        SOURCE_FALLBACK:     'sourceFallback',
        RESUME:              'resume',
        COUNT_IN:            'countIn',
        FULLSCREEN:          'fullscreen',
        AUTOPLAY_WATCHDOG:   'autoplayWatchdog',
        NOW_PLAYING_BAR:     'nowPlayingBar',
        LOCK_PRIMARY_VERSION:'lockPrimaryVersion',
        SOURCE_PREFERENCE:   'sourcePreference',

        // PAUSE_ALL — Stab #06 groundwork (2026-05-13). Declares that an
        // engine will pause itself when another engine asserts ownership of
        // the audio session. The actual global arbitration mechanism is NOT
        // YET IMPLEMENTED — this constant is reserved so engines can declare
        // readiness now (no behavior change) and a future build can wire up
        // a `GLPlayerContract.pauseAll(exceptEngine)` static that walks the
        // registry. See Reality Audit #04 §6 for the convergence rationale
        // and the multi-engine race conditions this is meant to close.
        // Ownership semantics: the canonical arbitrator (future) calls
        // `engine.pause()` on every registered engine that declares this
        // capability and is not the engine asserting ownership.
        PAUSE_ALL:           'pauseAll'
    });

    var REQUIRED_CAPABILITIES = [
        CAPABILITIES.QUEUE,
        CAPABILITIES.PLAYBACK,
        CAPABILITIES.STATE,
        CAPABILITIES.EVENTS
    ];

    // ── EVENTS ──────────────────────────────────────────────────────────────
    // Canonical event names. Conforming engines emit these via their own
    // on/off bus. Payload shapes are documented in spec §3.4.

    var EVENTS = Object.freeze({
        STATE_CHANGE:      'stateChange',       // { prev, state, isPlaying? }
        SONG_CHANGE:       'songChange',        // { idx, item, total }
        POSITION_CHANGE:   'positionChange',    // { positionSec, durationSec } — throttled ~4Hz
        SOURCE_RESOLVED:   'sourceResolved',    // { source, confidence, item }   — SOURCE_FALLBACK only
        STATUS:            'status',            // { message }                    — async progress text
        EMBED_READY:       'embedReady',        // { source, ...sourceData }      — UI creates embed
        QUEUE_END:         'queueEnd',          // { name }                       — no auto-loop
        ERROR:             'error',             // { code, message, recoverable }
        AUTOPLAY_BLOCKED:  'autoplayBlocked',   // { retry: () => void }          — UI shows tap-to-start
        LOOP_CHANGED:      'loopChanged',       // { inSec, outSec, enabled }     — LOOP only
        STEMS_CHANGED:     'stemsChanged'       // { stemId, change }             — STEMS only
    });

    // ── STATES ──────────────────────────────────────────────────────────────
    // Canonical engine-state names. READY is new (no current engine has it)
    // — covers "loaded, autoplay-blocked, awaiting user gesture".

    var STATE = Object.freeze({
        IDLE:      'IDLE',
        LOADING:   'LOADING',
        RESOLVING: 'RESOLVING',  // SOURCE_FALLBACK engines only
        READY:     'READY',      // loaded but not yet playing
        PLAYING:   'PLAYING',
        PAUSED:    'PAUSED',
        ENDED:     'ENDED',
        FALLBACK:  'FALLBACK',   // SOURCE_FALLBACK engines only
        ERROR:     'ERROR'
    });

    // ── INTENTS ─────────────────────────────────────────────────────────────
    // Consumer-side routing keys. Phase D's Workbench shell will pick an
    // engine per intent. C.1 just defines the names.

    var INTENTS = Object.freeze({
        STUDY:    'study',     // song-detail focus (Stems if available)
        REHEARSE: 'rehearse',  // rehearsal-mode chart overlay
        PERFORM:  'perform',   // live gig
        BROWSE:   'browse',    // setlist-card inline play
        QUEUE:    'queue'      // home-dashboard practice bundles
    });

    // ── CONFORMANCE CHECK ───────────────────────────────────────────────────
    // Sanity check — verifies an engine declares the required capabilities
    // and exposes the core surface for each. Returns { ok, missing } so a
    // dev-console probe can debug a wrap that's drifted from the contract.

    function conforms(engine) {
        var missing = [];
        if (!engine || typeof engine !== 'object') {
            return { ok: false, missing: ['<engine>'] };
        }
        if (typeof engine.id !== 'string') missing.push('id');
        if (!Array.isArray(engine.capabilities)) missing.push('capabilities');

        // Required capabilities must be declared
        if (Array.isArray(engine.capabilities)) {
            REQUIRED_CAPABILITIES.forEach(function (cap) {
                if (engine.capabilities.indexOf(cap) === -1) {
                    missing.push('capabilities:' + cap);
                }
            });
        }

        // Core surface
        var coreFns = [
            'loadQueue', 'next', 'prev', 'jumpTo', 'getQueue',
            'getCurrentIdx', 'getCurrentItem',
            'play', 'pause', 'stop', 'destroy',
            'getState', 'isPlaying', 'has',
            'on', 'off'
        ];
        coreFns.forEach(function (fn) {
            if (typeof engine[fn] !== 'function') missing.push(fn + '()');
        });

        return { ok: missing.length === 0, missing: missing };
    }

    // ── ENGINE REGISTRY ─────────────────────────────────────────────────────
    // C.2/C.3/C.4 will register conforming engines per intent. Phase D's
    // Workbench shell reads from the registry. C.1 ships the registry empty.

    var _registry = {};

    function register(intent, engine) {
        if (!intent || typeof intent !== 'string') {
            console.warn('[GLPlayerContract] register: invalid intent', intent);
            return false;
        }
        var check = conforms(engine);
        if (!check.ok) {
            console.warn('[GLPlayerContract] register: engine for intent "' +
                intent + '" does not conform — missing:', check.missing);
            return false;
        }
        _registry[intent] = engine;
        return true;
    }

    function get(intent) {
        return _registry[intent] || null;
    }

    function getAll() {
        var out = {};
        Object.keys(_registry).forEach(function (k) { out[k] = _registry[k]; });
        return out;
    }

    function unregister(intent) {
        if (_registry[intent]) {
            delete _registry[intent];
            return true;
        }
        return false;
    }

    // ── PAUSABLE REGISTRY (Stab #07) ────────────────────────────────────────
    // Non-engine playback surfaces (harmony-lab, bestshot, ad-hoc <audio>
    // owners) register a pause function here so pauseAll() can quiet them
    // alongside the engine registry. Keyed by stable id; idempotent on
    // re-registration so a re-rendered feature module doesn't stack entries.

    var _pausables = {};

    function registerPausable(id, pauseFn) {
        if (!id || typeof id !== 'string' || typeof pauseFn !== 'function') {
            console.warn('[GLPlayerContract] registerPausable: bad args', id);
            return false;
        }
        _pausables[id] = pauseFn;
        return true;
    }

    function unregisterPausable(id) {
        if (_pausables[id]) {
            delete _pausables[id];
            return true;
        }
        return false;
    }

    // ── pauseAll(exceptId) — Stab #07 arbitration core ──────────────────────
    // Single authoritative "stop everything except me" hook. Engines call
    // this BEFORE asserting playback ownership so concurrent audio across
    // surfaces is impossible by construction.
    //
    // Walks two registries:
    //   1. _registry (engine adapters keyed by intent) — pauses any adapter
    //      that declares CAPABILITIES.PAUSE_ALL. Dedupes by engine.id so an
    //      adapter registered for multiple intents pauses only once.
    //   2. _pausables (ad-hoc surfaces keyed by id) — calls pauseFn().
    //
    // exceptId can be a string id OR an object with an .id property OR null
    // (pause everything). Errors are caught and logged — a failing engine
    // cannot block the cascade.
    //
    // Recursion protection: `_arbitrating` flag guards re-entrant calls so
    // a misbehaving pause() that triggers another pauseAll cannot create a
    // runaway loop. Re-entrant calls are silently dropped (already
    // arbitrating; the outer call will reach every surface).
    //
    // Logging: one compact summary line per cascade. Verbose enough to
    // debug a missing pause; quiet enough to not spam the console during
    // normal use.

    var _arbitrating = false;

    // Stab #10 (2026-05-13): lightweight stats for GLRuntimeHealth overlay.
    // Purely observational — no behavior change.
    var _stats = {
        pauseAllCalls: 0,
        reentrantDropped: 0,
        lastPauseAllAt: null,
        lastExceptId: null,
        lastPaused: [],
        lastSkipped: [],
        lastFailed: [],
        totalPauseFailures: 0,
    };

    function pauseAll(except) {
        if (_arbitrating) {
            // Re-entrant call — drop silently. The outer pauseAll() owns
            // the cascade and will reach every surface anyway.
            _stats.reentrantDropped++;
            return { paused: [], skipped: ['<re-entrant>'], failed: [] };
        }
        _arbitrating = true;

        var exceptId = (except && typeof except === 'object') ? except.id : except;
        var seen = {};
        var paused = [];
        var skipped = [];
        var failed = [];

        try {
            // Walk engine registry — dedupe by engine.id
            Object.keys(_registry).forEach(function (intent) {
                var eng = _registry[intent];
                if (!eng || !eng.id || seen[eng.id]) return;
                seen[eng.id] = true;
                if (eng.id === exceptId) { skipped.push(eng.id + ':except'); return; }
                var caps = eng.capabilities || [];
                if (caps.indexOf(CAPABILITIES.PAUSE_ALL) === -1) {
                    skipped.push(eng.id + ':no-cap');
                    return;
                }
                if (typeof eng.pause !== 'function') {
                    skipped.push(eng.id + ':no-pause');
                    return;
                }
                try { eng.pause(); paused.push(eng.id); }
                catch (e) {
                    failed.push(eng.id);
                    console.warn('[GLPlayerContract.pauseAll] engine pause failed:', eng.id, e && e.message);
                }
            });

            // Walk ad-hoc pausable registry
            Object.keys(_pausables).forEach(function (id) {
                if (id === exceptId) { skipped.push(id + ':except'); return; }
                try { _pausables[id](); paused.push(id); }
                catch (e) {
                    failed.push(id);
                    console.warn('[GLPlayerContract.pauseAll] pausable failed:', id, e && e.message);
                }
            });
        } finally {
            _arbitrating = false;
        }

        // Only log when something interesting happened (something paused
        // or something failed). Skipping silently keeps the console quiet.
        if (paused.length || failed.length) {
            console.log('[GLPlayerContract.pauseAll]',
                'except=' + (exceptId || '<none>'),
                'paused=' + JSON.stringify(paused),
                (skipped.length ? 'skipped=' + JSON.stringify(skipped) : ''),
                (failed.length ? 'failed=' + JSON.stringify(failed) : ''));
        }

        // Stab #10 (2026-05-13): snapshot for GLRuntimeHealth.
        _stats.pauseAllCalls++;
        _stats.lastPauseAllAt = Date.now();
        _stats.lastExceptId = exceptId || null;
        _stats.lastPaused = paused.slice();
        _stats.lastSkipped = skipped.slice();
        _stats.lastFailed = failed.slice();
        _stats.totalPauseFailures += failed.length;

        return { paused: paused, skipped: skipped, failed: failed };
    }

    function getStats() {
        // Stab #10: snapshot for GLRuntimeHealth. Includes live registry sizes
        // alongside the rolling pauseAll stats.
        return {
            registryCount: Object.keys(_registry).length,
            pausableCount: Object.keys(_pausables).length,
            registryIntents: Object.keys(_registry),
            pausableIds: Object.keys(_pausables),
            pauseAllAvailable: true,
            pauseAllCalls: _stats.pauseAllCalls,
            reentrantDropped: _stats.reentrantDropped,
            lastPauseAllAt: _stats.lastPauseAllAt,
            lastExceptId: _stats.lastExceptId,
            lastPaused: _stats.lastPaused.slice(),
            lastSkipped: _stats.lastSkipped.slice(),
            lastFailed: _stats.lastFailed.slice(),
            totalPauseFailures: _stats.totalPauseFailures,
            arbitrating: _arbitrating,
        };
    }

    // ── PUBLIC API ──────────────────────────────────────────────────────────

    return {
        CAPABILITIES: CAPABILITIES,
        REQUIRED_CAPABILITIES: REQUIRED_CAPABILITIES,
        EVENTS: EVENTS,
        STATE: STATE,
        INTENTS: INTENTS,
        conforms: conforms,
        register: register,
        unregister: unregister,
        get: get,
        getAll: getAll,
        // Stab #07 arbitration
        registerPausable: registerPausable,
        unregisterPausable: unregisterPausable,
        pauseAll: pauseAll,
        // Stab #10 observability
        getStats: getStats
    };

})();

console.log('🎚 gl-player-contract.js loaded (Phase C.1)');
