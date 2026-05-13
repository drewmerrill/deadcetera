// ============================================================================
// js/core/gl-setlist-player-contract.js — SetlistPlayer Contract Adapter (Phase C.4)
//
// Thin wrapper around the existing SetlistPlayer (js/features/setlist-player.js).
// Existing public + window-exported handlers are unchanged; the adapter calls
// into them via the small window._slpAPI accessor surface added alongside this
// module in C.4.
//
// Spec lives at: 02_GrooveLinx/specs/player_engine_contract.md
//
// Same minimal-blast-radius pattern as C.2 (GLPlayerEngine) and C.3 (Stems
// mixer). SetlistPlayer keeps working identically — every existing consumer
// (setlists.js, gigs.js, app.js) calls window.SetlistPlayer.X directly.
//
// Capabilities declared (10 of 16):
//   • QUEUE / PLAYBACK / STATE / EVENTS         (required core)
//   • SOURCE_FALLBACK     (3-source resolution chain)
//   • SOURCE_PREFERENCE   (user-pickable order, persisted)
//   • RESUME              (24h TTL state in `gl_player_state`)
//   • AUTOPLAY_WATCHDOG   (D6 fix — surfaced as AUTOPLAY_BLOCKED event)
//   • NOW_PLAYING_BAR     (minimized bar persists across overlay close)
//   • LOCK_PRIMARY_VERSION (save current YouTube ID as isPrimary)
//
// Capabilities NOT claimed:
//   • SEEK / VOLUME / TEMPO / PITCH / LOOP / STEMS / COUNT_IN / FULLSCREEN
//                                — Stems mixer territory (C.3)
//
// Registers with INTENTS.BROWSE (setlist card inline play). GLPlayerEngine
// is also a candidate for BROWSE per the catalog, but setlists.js +
// gigs.js use GLPlayerEngine FIRST and fall back to SetlistPlayer; per
// the C.2 adapter notes, the fallback engine is the canonical one for
// BROWSE so SetlistPlayer claims that intent here.
//
// SYSTEM LOCKs preserved (CLAUDE.md §7): _navSeq, focusChanged, Firebase
// error filter, ACTIVE_STATUSES — all untouched.
//
// LOAD ORDER NOTE: this module must load AFTER setlist-player.js so the
// _slpAPI accessor surface exists at adapter construction time (the
// AUTOPLAY_BLOCKED subscription is wired at construction, not lazy).
// Index files are wired accordingly.
// ============================================================================

'use strict';

window.GLSetlistPlayerContract = (function () {

    var C = window.GLPlayerContract;
    if (!C) {
        console.warn('[GLSetlistPlayerContract] GLPlayerContract not loaded — adapter inert');
        return null;
    }

    var P = window.SetlistPlayer;
    if (!P) {
        console.warn('[GLSetlistPlayerContract] SetlistPlayer not loaded — adapter inert');
        return null;
    }

    function S() { return window._slpAPI || null; }

    // ── State derivation ────────────────────────────────────────────────────
    // SetlistPlayer doesn't have an explicit state machine — derive from
    // queue + overlay + isPlaying. PAUSED vs READY: PAUSED means the user
    // (or end-of-current-song) stopped after playing; READY means the
    // overlay is open with a queue but nothing has played yet.
    function deriveState() {
        var s = S();
        if (!s) return C.STATE.IDLE;
        if (!s.isLaunched()) return C.STATE.IDLE;
        if (s.isPlaying()) return C.STATE.PLAYING;
        if (s.isOverlayOpen()) return C.STATE.READY;
        return C.STATE.PAUSED;
    }

    // ── Internal pub/sub bus ────────────────────────────────────────────────
    var _listeners = {};
    function on(event, fn) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(fn);
    }
    function off(event, fn) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(function (f) { return f !== fn; });
    }
    function _emit(event, data) {
        (_listeners[event] || []).forEach(function (fn) { try { fn(data); } catch (e) {} });
    }

    // ── Adapter ─────────────────────────────────────────────────────────────

    var adapter = {
        id: 'gl-setlist-player',

        capabilities: [
            C.CAPABILITIES.QUEUE,
            C.CAPABILITIES.PLAYBACK,
            C.CAPABILITIES.STATE,
            C.CAPABILITIES.EVENTS,
            C.CAPABILITIES.SOURCE_FALLBACK,
            C.CAPABILITIES.SOURCE_PREFERENCE,
            C.CAPABILITIES.RESUME,
            C.CAPABILITIES.AUTOPLAY_WATCHDOG,
            C.CAPABILITIES.NOW_PLAYING_BAR,
            C.CAPABILITIES.LOCK_PRIMARY_VERSION,
            C.CAPABILITIES.PAUSE_ALL  // Stab #07 — participates in arbitration
        ],

        // ── Queue ───────────────────────────────────────────────────────────
        // SetlistPlayer's launch() expects a setlist-shaped object with
        // .sets[].songs[]. Adapter accepts either:
        //   - that shape directly (passed through)
        //   - a flat items[] array (wrapped into a single-set setlist)
        loadQueue: function (items, opts) {
            opts = opts || {};
            var setlistObj;
            if (items && Array.isArray(items.sets)) {
                setlistObj = items;
            } else if (Array.isArray(items)) {
                setlistObj = {
                    name: opts.name || 'Queue',
                    id:   opts.id   || null,
                    sets: [{ name: 'Set 1', songs: items }]
                };
            } else {
                return adapter;
            }
            P.launch(setlistObj, opts.name || setlistObj.name || 'Queue', opts.startIdx || 0);
            return adapter;
        },
        next:    function () { return P.next(); },
        prev:    function () { return P.prev(); },
        jumpTo:  function (idx) { return P.playFromIndex(idx); },
        getQueue:        function () { var s = S(); return s ? s.getQueue() : []; },
        getCurrentIdx:   function () { var s = S(); return s ? s.getCurrentIdx() : -1; },
        getCurrentItem:  function () { var s = S(); return s ? s.getCurrentItem() : null; },

        // ── Playback ────────────────────────────────────────────────────────
        // SetlistPlayer exposes togglePlay (YouTube-only; Spotify/Archive
        // embeds aren't externally controllable). Adapter checks state for
        // idempotent play/pause.
        play: function (idx) {
            if (typeof idx === 'number') return P.playFromIndex(idx);
            var s = S();
            if (s && s.isLaunched() && !s.isPlaying() && typeof P.togglePlay === 'function') {
                return P.togglePlay();
            }
        },
        pause: function () {
            var s = S();
            if (s && s.isLaunched() && s.isPlaying() && typeof P.togglePlay === 'function') {
                return P.togglePlay();
            }
        },
        stop:    function () { return P.close(); },     // minimize to NowPlayingBar
        destroy: function () { return P.fullClose(); }, // full teardown

        // ── State ───────────────────────────────────────────────────────────
        getState:  deriveState,
        isPlaying: function () { var s = S(); return s ? s.isPlaying() : false; },
        has:       function (cap) { return adapter.capabilities.indexOf(cap) !== -1; },

        // ── Events ──────────────────────────────────────────────────────────
        on:    on,
        off:   off,
        _emit: _emit,

        // ── SOURCE_FALLBACK + SOURCE_PREFERENCE + LOCK_PRIMARY_VERSION ─────
        source: {
            getActive: function () { var s = S(); return s ? s.getCurrentSource() : null; },
            getActiveResult: function () {
                var s = S();
                return s ? { source: s.getCurrentSource() } : null;
            },
            retry: function () {
                if (typeof P._retrySearch === 'function') return P._retrySearch();
            },
            playFromUrl: function (url) {
                // Engine's _playPastedUrl reads from #slpPastedUrl input —
                // write the URL there first, then trigger.
                if (typeof P._playPastedUrl !== 'function') return false;
                var input = document.getElementById('slpPastedUrl');
                if (input) input.value = url;
                return P._playPastedUrl();
            },
            setPreference: function (pref) { return P.setSourcePref(pref); },
            getPreference: function () { return P.getSourcePref(); },
            lockPrimary:   function () {
                if (typeof P._lockCurrentVersion === 'function') {
                    return P._lockCurrentVersion();
                }
                return false;
            }
        },

        // ── RESUME ──────────────────────────────────────────────────────────
        resume: {
            getState:   function ()       { return P.getResumeState(); },
            clearState: function ()       { return P.clearResumeState(); },
            showPrompt: function (cId)    { return P.showResumePrompt(cId); }
        },

        // ── AUTOPLAY_WATCHDOG ───────────────────────────────────────────────
        // Engine self-arms / self-clears the 1.6s watchdog inside
        // _embedYouTube / _armAutoplayWatchdog. UI doesn't need to manage
        // it — the contract surface here is just for future engines that
        // have an opt-in watchdog. The actual signal Phase D consumes is
        // the AUTOPLAY_BLOCKED event (subscribed below at construction).
        autoplay: {
            armWatchdog:   function () { return false; }, // engine auto-arms
            clearWatchdog: function () { return false; }  // engine auto-clears
        },

        // ── NOW_PLAYING_BAR ─────────────────────────────────────────────────
        // Bar's lifecycle is owned by SetlistPlayer — auto-shown on close()
        // (which minimizes overlay), removed on fullClose(). No imperative
        // show/hide from outside.
        nowPlayingBar: {
            isVisible: function () { var s = S(); return s ? s.isNowPlayingBarOpen() : false; }
        }
    };

    // ── Wire AUTOPLAY_BLOCKED contract event to SetlistPlayer's D6 hook ────
    // _slpAPI exists at construction time because this module loads AFTER
    // setlist-player.js (see index.html / index-dev.html). The retry
    // function calls back into the adapter's play() so consumers don't
    // need to know about the underlying engine API.
    if (typeof window._slpAPI !== 'undefined' &&
        typeof window._slpAPI.onAutoplayBlocked === 'function') {
        window._slpAPI.onAutoplayBlocked(function () {
            _emit(C.EVENTS.AUTOPLAY_BLOCKED, {
                retry: function () {
                    var s = S();
                    if (s && s.isLaunched()) adapter.play();
                }
            });
        });
    }

    // ── Self-register with INTENTS.BROWSE ──────────────────────────────────
    if (typeof C.register === 'function') {
        C.register(C.INTENTS.BROWSE, adapter);
    }

    return adapter;

})();

console.log('🎚 gl-setlist-player-contract.js loaded (Phase C.4)');
