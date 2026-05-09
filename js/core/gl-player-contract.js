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
        SOURCE_PREFERENCE:   'sourcePreference'
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
        getAll: getAll
    };

})();

console.log('🎚 gl-player-contract.js loaded (Phase C.1)');
