// ============================================================================
// js/core/gl-player-engine-contract.js — GLPlayerEngine Contract Adapter (Phase C.2)
//
// Thin wrapper around the existing GLPlayerEngine that exposes the canonical
// surface defined by GLPlayerContract (Phase C.1). Existing API on
// GLPlayerEngine is unchanged — every existing consumer keeps working
// identically. This adapter is purely additive.
//
// Spec lives at: 02_GrooveLinx/specs/player_engine_contract.md
//
// Capabilities declared:
//   • QUEUE / PLAYBACK / STATE / EVENTS (required core)
//   • SOURCE_FALLBACK (engine has resolver-driven YT/Spotify/Archive routing)
//   • RESUME           (24h TTL state in `gl_engine_state`)
//
// Capabilities NOT claimed (intentional, see spec §2):
//   • SEEK             — engine only exposes seekRelative (YouTube-only).
//                        Phase D consumers can use the underlying engine
//                        directly until a richer seek surface lands.
//   • VOLUME / TEMPO / PITCH / LOOP / STEMS  — Stems engine territory (C.3)
//   • COUNT_IN / FULLSCREEN                  — Stems engine territory (C.3)
//   • AUTOPLAY_WATCHDOG / NOW_PLAYING_BAR / LOCK_PRIMARY_VERSION
//                                            — SetlistPlayer territory (C.4)
//   • SOURCE_PREFERENCE — driven by GLSourceResolver, not this engine
//
// Registers with INTENTS.QUEUE (home-dashboard practice bundles) and
// INTENTS.PERFORM (live gig setlist playback) — its current consumers.
// SetlistPlayer will register for INTENTS.BROWSE in C.4. Stems engine
// will register for INTENTS.STUDY in C.3.
//
// SYSTEM LOCKs preserved (CLAUDE.md §7): _navSeq, focusChanged, Firebase
// error filter, ACTIVE_STATUSES — all untouched.
// ============================================================================

'use strict';

window.GLPlayerEngineContract = (function () {

    var C = window.GLPlayerContract;
    var E = window.GLPlayerEngine;

    if (!C) {
        console.warn('[GLPlayerEngineContract] GLPlayerContract not loaded — adapter inert');
        return null;
    }
    if (!E) {
        console.warn('[GLPlayerEngineContract] GLPlayerEngine not loaded — adapter inert');
        return null;
    }

    // ── State mapping ───────────────────────────────────────────────────────
    // Engine emits: IDLE / LOADING / RESOLVING / PLAYING / FALLBACK / ERROR.
    // Contract adds PAUSED + READY + ENDED. We synthesize PAUSED from
    // (state===PLAYING && !isPlaying), which is how the engine encodes a
    // user-paused YouTube player. READY/ENDED don't apply to this engine.

    function mapState() {
        var s = E.getState();
        if (s === 'PLAYING' && !E.isPlaying()) return C.STATE.PAUSED;
        return s;
    }

    // ── Adapter ─────────────────────────────────────────────────────────────

    var adapter = {
        id: 'gl-player-engine',

        capabilities: [
            C.CAPABILITIES.QUEUE,
            C.CAPABILITIES.PLAYBACK,
            C.CAPABILITIES.STATE,
            C.CAPABILITIES.EVENTS,
            C.CAPABILITIES.SOURCE_FALLBACK,
            C.CAPABILITIES.RESUME
        ],

        // ── Queue ───────────────────────────────────────────────────────────
        loadQueue: function (items, opts) { return E.loadQueue(items, opts); },
        next:      function ()             { return E.next(); },
        prev:      function ()             { return E.prev(); },
        jumpTo:    function (idx)          { return E.play(idx); },
        getQueue:        function () { return E.getQueue(); },
        getCurrentIdx:   function () { return E.getCurrentIdx(); },
        getCurrentItem:  function () { return E.getCurrentSong(); },

        // ── Playback ────────────────────────────────────────────────────────
        // play(idx)         → engine.play(idx) — restart-from-top semantics
        // play() while paused → engine.togglePlay() — resume in place
        // play() while idle → engine.play() — defaults to idx 0
        // play() while playing → no-op
        play: function (idx) {
            if (typeof idx === 'number') return E.play(idx);
            var s = E.getState();
            if (s === 'PLAYING' && !E.isPlaying()) return E.togglePlay();
            if (s === 'IDLE') return E.play();
            // already in-flight (LOADING/RESOLVING) or playing — no-op
        },
        pause: function () {
            if (E.isPlaying()) return E.togglePlay();
            // already paused — no-op (idempotent)
        },
        stop:    function () { return E.stop(); },
        destroy: function () { return E.destroy(); },

        // ── State ───────────────────────────────────────────────────────────
        getState:  mapState,
        isPlaying: function () { return E.isPlaying(); },
        has:       function (cap) { return adapter.capabilities.indexOf(cap) !== -1; },

        // ── Events ──────────────────────────────────────────────────────────
        // Engine event names already match the contract's canonical names
        // (stateChange / songChange / sourceResolved / status / embedReady /
        // queueEnd) — pass through directly. Engine does NOT emit
        // POSITION_CHANGE / ERROR (as event) / AUTOPLAY_BLOCKED / LOOP_CHANGED
        // / STEMS_CHANGED — that's by design (those are other engines' jobs).
        on:  function (eventName, handler) { return E.on(eventName, handler); },
        off: function (eventName, handler) { return E.off(eventName, handler); },

        // ── SOURCE_FALLBACK namespace ──────────────────────────────────────
        source: {
            getActive:       function () { return E.getActiveSource(); },
            getActiveResult: function () { return E.getActiveResult(); },
            retry:           function () { return E.retryCurrentSong(); },
            playFromUrl:     function (url) { return E.playYouTubeUrl(url); },
            // Preference + lockPrimary aren't implemented by this engine.
            // GLSourceResolver owns preference; SetlistPlayer owns lock.
            // Return falsy so callers can detect absence.
            setPreference:   function () { return false; },
            getPreference:   function () { return null; },
            lockPrimary:     function () { return false; }
        },

        // ── RESUME namespace ───────────────────────────────────────────────
        resume: {
            getState:   function () { return E.getResumeState(); },
            clearState: function () { return E.clearResumeState(); },
            // showPrompt is a UI concern (GLPlayerUI implements it).
            // Engine doesn't render UI — return false.
            showPrompt: function () { return false; }
        }
    };

    // ── Register with intents this engine serves ────────────────────────────
    // Confirmed consumers from the C.1 catalog:
    //   • home-dashboard.js   (practice bundles)        → INTENTS.QUEUE
    //   • live-gig.js         (live gig playback)       → INTENTS.PERFORM
    //   • gigs.js / setlists.js (setlist play, GLPlayerEngine preferred over
    //                            SetlistPlayer fallback) — could claim BROWSE
    //                            here, but defer to C.4 so SetlistPlayer can
    //                            be the canonical BROWSE engine and this
    //                            engine remains the fallback path it already
    //                            is in those call sites.

    if (typeof C.register === 'function') {
        C.register(C.INTENTS.QUEUE, adapter);
        C.register(C.INTENTS.PERFORM, adapter);
    }

    return adapter;

})();

console.log('🎚 gl-player-engine-contract.js loaded (Phase C.2)');
