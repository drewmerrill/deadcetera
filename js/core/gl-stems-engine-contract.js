// ============================================================================
// js/core/gl-stems-engine-contract.js — Stems Mixer Contract Adapter (Phase C.3)
//
// Thin wrapper around the existing Stems WebAudio Mixer (embedded in
// js/features/song-detail.js, lines ~1750-3500). All _sdStems* window
// handlers + module-private state are unchanged; the adapter calls into
// them via the small window._sdStemsAPI accessor surface added alongside
// this module in C.3.
//
// Spec lives at: 02_GrooveLinx/specs/player_engine_contract.md
//
// Per Drew's C.3 directive: ADAPTER ONLY, no extraction. Zero regression
// risk to the working stems UI. Full extraction deferred to a future phase
// (C.5 or E.1) once the Workbench shell is live, the contract is proven,
// and we have stems test coverage.
//
// Capabilities declared (12 of 16):
//   • QUEUE / PLAYBACK / STATE / EVENTS         (required core)
//   • SEEK / VOLUME / TEMPO / PITCH / LOOP / STEMS / COUNT_IN / FULLSCREEN
//
// Capabilities NOT claimed:
//   • SOURCE_FALLBACK / RESUME / SOURCE_PREFERENCE
//                       — GLPlayerEngine territory (see C.2 adapter)
//   • AUTOPLAY_WATCHDOG / NOW_PLAYING_BAR / LOCK_PRIMARY_VERSION
//                       — SetlistPlayer territory (C.4)
//
// Registers with INTENTS.STUDY (song-detail Stems lens).
//
// Note on EVENTS:
//   The on/off bus is wired and conformance-passing, but the underlying
//   Stems mixer doesn't currently emit events. Phase D consumers can
//   poll via getState() / loop.get() / isPlaying(), or a follow-up phase
//   can add light emit-side hooks inside song-detail.js.
//
// SYSTEM LOCKs preserved (CLAUDE.md §7): _navSeq, focusChanged, Firebase
// error filter, ACTIVE_STATUSES — all untouched.
// ============================================================================

'use strict';

window.GLStemsEngineContract = (function () {

    var C = window.GLPlayerContract;
    if (!C) {
        console.warn('[GLStemsEngineContract] GLPlayerContract not loaded — adapter inert');
        return null;
    }

    // Lazy lookup at call time — _sdStemsAPI is created by song-detail.js
    // which loads later than this adapter. Adapter object construction +
    // contract registration happen at adapter-load time; method calls
    // happen at runtime, by which point _sdStemsAPI exists.
    function S() { return window._sdStemsAPI || null; }

    function getCurrentTitle() { return window._sdCurrentSong || null; }

    // ── State derivation ────────────────────────────────────────────────────
    // Engine has no explicit state machine — derive from mount + audio
    // element state. PAUSED vs READY distinction: READY means "mounted but
    // never played"; PAUSED means "mounted, was playing, currently paused".
    function deriveState() {
        var s = S();
        if (!s) return C.STATE.IDLE;
        if (!s.isMounted()) return C.STATE.IDLE;
        var t = s.getCurrentTime();
        var d = s.getDuration();
        var playing = s.isPlaying();
        if (playing) return C.STATE.PLAYING;
        if (d > 0 && t >= d - 0.1) return C.STATE.ENDED;
        if (t > 0) return C.STATE.PAUSED;
        return C.STATE.READY;
    }

    // ── Internal pub/sub (engine doesn't currently emit; future-proofs Phase D) ──
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
        id: 'gl-stems-engine',

        capabilities: [
            C.CAPABILITIES.QUEUE,
            C.CAPABILITIES.PLAYBACK,
            C.CAPABILITIES.STATE,
            C.CAPABILITIES.EVENTS,
            C.CAPABILITIES.SEEK,
            C.CAPABILITIES.VOLUME,
            C.CAPABILITIES.TEMPO,
            C.CAPABILITIES.PITCH,
            C.CAPABILITIES.LOOP,
            C.CAPABILITIES.STEMS,
            C.CAPABILITIES.COUNT_IN,
            C.CAPABILITIES.FULLSCREEN,
            C.CAPABILITIES.PAUSE_ALL  // Stab #07 — participates in arbitration
        ],

        // ── QUEUE (single-item) ─────────────────────────────────────────────
        // Stems plays one song at a time. The actual song-load (audio
        // element creation, separation flow, lens render) is owned by
        // song-detail.js — calling loadQueue here does NOT re-render the
        // lens. Method exists so consumers can declare intent uniformly.
        loadQueue: function (/* items, opts */) { return adapter; },
        next:      function () { /* single-item — no-op */ },
        prev:      function () { /* single-item — no-op */ },
        jumpTo:    function () { /* single-item — no-op */ },
        getQueue: function () {
            var t = getCurrentTitle();
            return t ? [{ title: t }] : [];
        },
        getCurrentIdx:  function () { return getCurrentTitle() ? 0 : -1; },
        getCurrentItem: function () {
            var t = getCurrentTitle();
            return t ? { title: t } : null;
        },

        // ── PLAYBACK ────────────────────────────────────────────────────────
        // Engine exposes _sdStemsToggle (a toggle) — adapter checks state
        // first to make play/pause idempotent.
        play: function () {
            var s = S();
            if (s && s.isMounted() && !s.isPlaying() && typeof window._sdStemsToggle === 'function') {
                return window._sdStemsToggle();
            }
        },
        pause: function () {
            var s = S();
            if (s && s.isMounted() && s.isPlaying() && typeof window._sdStemsToggle === 'function') {
                return window._sdStemsToggle();
            }
        },
        stop: function () {
            // Engine has no explicit stop; pause + seek-to-0 is closest.
            // Most consumers don't need this — lens unmount handles teardown.
            adapter.pause();
            adapter.seek.to(0);
        },
        destroy: function () {
            // Lifecycle owned by song-detail.js. _sdPopulateStemsLens unmount
            // path clears driftTimer + nulls _sdStemsState.
        },

        // ── STATE ───────────────────────────────────────────────────────────
        getState:  deriveState,
        isPlaying: function () { var s = S(); return s ? s.isPlaying() : false; },
        has:       function (cap) { return adapter.capabilities.indexOf(cap) !== -1; },

        // ── EVENTS ──────────────────────────────────────────────────────────
        on:    on,
        off:   off,
        _emit: _emit,  // internal — not part of the public contract

        // ── SEEK ────────────────────────────────────────────────────────────
        seek: {
            to: function (positionSec) {
                if (typeof window._sdStemsApplySeek === 'function') {
                    return window._sdStemsApplySeek(positionSec);
                }
            },
            relative: function (deltaSec) {
                if (typeof window._sdStemsSeekBy === 'function') {
                    return window._sdStemsSeekBy(deltaSec);
                }
            },
            getPosition: function () { var s = S(); return s ? s.getCurrentTime() : 0; },
            getDuration: function () { var s = S(); return s ? s.getDuration() : 0; }
        },

        // ── VOLUME ──────────────────────────────────────────────────────────
        // Stems engine has no master volume slider — only per-stem.
        // master.get returns the AVERAGE of per-stem volumes; master.set
        // is a no-op (no fader to write to). Per-stem control lives under
        // .stems.setVolume / .stems.setPan below.
        volume: {
            set: function () { return false; },
            get: function () {
                var s = S(); if (!s) return 0;
                var stems = s.getStemList();
                if (!stems.length) return 0;
                var sum = 0, count = 0;
                stems.forEach(function (t) {
                    var st = s.getStemRowState(t.id);
                    if (st && st.volume != null) { sum += st.volume; count++; }
                });
                return count ? (sum / count) : 0;
            }
        },

        // ── TEMPO ───────────────────────────────────────────────────────────
        // Routes through the existing #sdStemsTempo slider so the engine's
        // input-event listener fires (which sets playbackRate on every
        // .sd-stem-audio + updates the display).
        tempo: {
            set: function (rate) {
                var slider = document.getElementById('sdStemsTempo');
                if (!slider) return false;
                slider.value = String(Math.round(rate * 100));
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            },
            get: function () { var s = S(); return s ? s.getTempo() : 1; },
            setPreservePitch: function (bool) {
                var cb = document.getElementById('sdStemsPreservePitch');
                if (!cb) return false;
                cb.checked = !!bool;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        },

        // ── PITCH ───────────────────────────────────────────────────────────
        // Engine UI is ±1 buttons + reset (no absolute setter). For now
        // adapter exposes get + reset; setSemitones is a no-op until the
        // engine grows a direct setter. Phase D consumers needing absolute
        // pitch should request the engine extension.
        pitch: {
            setSemitones: function () { return false; },
            getSemitones: function () { var s = S(); return s ? s.getPitchSemitones() : 0; },
            reset: function () {
                var btn = document.getElementById('sdStemsPitchReset');
                if (btn) btn.click();
                return !!btn;
            }
        },

        // ── LOOP ────────────────────────────────────────────────────────────
        // setIn(positionSec) / setOut(positionSec) — explicit position.
        // setIn() / setOut() (no arg) — set at current playhead via
        // _sdStemsSetLoopInHere / _sdStemsSetLoopOutHere.
        loop: {
            setIn: function (positionSec) {
                if (typeof positionSec === 'number' && typeof window._sdStemsSetLoopIn === 'function') {
                    return window._sdStemsSetLoopIn(positionSec);
                }
                if (typeof window._sdStemsSetLoopInHere === 'function') {
                    return window._sdStemsSetLoopInHere();
                }
            },
            setOut: function (positionSec) {
                if (typeof positionSec === 'number' && typeof window._sdStemsSetLoopOut === 'function') {
                    return window._sdStemsSetLoopOut(positionSec);
                }
                if (typeof window._sdStemsSetLoopOutHere === 'function') {
                    return window._sdStemsSetLoopOutHere();
                }
            },
            toggle: function () {
                if (typeof window._sdStemsToggleLoop === 'function') {
                    return window._sdStemsToggleLoop();
                }
            },
            clear: function () {
                if (typeof window._sdStemsClearLoop === 'function') {
                    return window._sdStemsClearLoop();
                }
            },
            get: function () {
                var s = S(); return s ? s.getLoop() : { inSec: null, outSec: null, enabled: false };
            },
            recent: function () {
                var s = S(); return s ? s.getRecentLoops() : [];
            }
        },

        // ── STEMS ───────────────────────────────────────────────────────────
        // Per-stem controls. Routes through existing slider input events
        // so the engine's input-event listeners fire (gain/pan node updates).
        stems: {
            list: function () { var s = S(); return s ? s.getStemList() : []; },
            getState: function (stemId) {
                var s = S(); return s ? s.getStemRowState(stemId) : null;
            },
            setVolume: function (stemId, vol01) {
                var slider = document.querySelector('.sd-stem-vol[data-stem="' + stemId + '"]');
                if (!slider) return false;
                slider.value = String(Math.round(vol01 * 100));
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            },
            setPan: function (stemId, pan11) {
                var slider = document.querySelector('.sd-stem-pan[data-stem="' + stemId + '"]');
                if (!slider) return false;
                slider.value = String(Math.round(pan11 * 100));
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            },
            mute: function (stemId, bool) {
                var btn = document.querySelector('.sd-stem-mute[data-stem="' + stemId + '"]');
                if (!btn) return false;
                var s = S();
                var current = s ? ((s.getStemRowState(stemId) || {}).muted) : false;
                if (current !== !!bool) btn.click();
                return true;
            },
            solo: function (stemId, bool) {
                var btn = document.querySelector('.sd-stem-solo[data-stem="' + stemId + '"]');
                if (!btn) return false;
                var s = S();
                var current = s ? ((s.getStemRowState(stemId) || {}).soloed) : false;
                if (current !== !!bool) btn.click();
                return true;
            },
            applyPreset: function (stemId) {
                if (typeof window._sdStemsApplyPreset === 'function') {
                    return window._sdStemsApplyPreset(stemId);
                }
            },
            resetPresets: function () {
                if (typeof window._sdStemsResetPresets === 'function') {
                    return window._sdStemsResetPresets();
                }
            },
            resetVolumes: function () {
                if (typeof window._sdStemsResetVolumes === 'function') {
                    return window._sdStemsResetVolumes();
                }
            },
            resetPan: function (stemId) {
                if (typeof window._sdStemsResetPan === 'function') {
                    return window._sdStemsResetPan(stemId);
                }
            },
            getActivePreset: function () {
                var s = S(); return s ? s.getActivePreset() : null;
            }
        },

        // ── COUNT_IN ────────────────────────────────────────────────────────
        countIn: {
            setEnabled: function (bool) {
                window._sdCountInEnabled = !!bool;
                var cb = document.getElementById('sdStemsCountIn');
                if (cb) cb.checked = !!bool;
                return true;
            },
            isEnabled: function () { var s = S(); return s ? s.getCountInEnabled() : true; }
        },

        // ── FULLSCREEN ──────────────────────────────────────────────────────
        fullscreen: {
            toggle: function () {
                if (typeof window._sdStemsToggleFullscreen === 'function') {
                    return window._sdStemsToggleFullscreen();
                }
            },
            isActive: function () { var s = S(); return s ? s.isFullscreen() : false; }
        }
    };

    // Self-register with INTENTS.STUDY (song-detail Stems lens consumes)
    if (typeof C.register === 'function') {
        C.register(C.INTENTS.STUDY, adapter);
    }

    return adapter;

})();

console.log('🎚 gl-stems-engine-contract.js loaded (Phase C.3)');
