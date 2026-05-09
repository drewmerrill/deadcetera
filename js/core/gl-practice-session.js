// ─────────────────────────────────────────────────────────────────────────────
// gl-practice-session.js — Practice Session persistence layer
//
// Wave 2 of the Practice Page redesign. Local-first storage of "what the
// user was working on" so Resume Last Session can re-arm the chart overlay
// exactly where they left off.
//
// Schema (localStorage key: 'gl_practice_session_v1'):
//   {
//     songId:       <string>          // canonical key (song title for now)
//     songTitle:    <string>          // display label
//     section:      { in, out } | null
//     mode:         'focus' | 'part' | 'harmony' | 'learn' | 'chart'
//     settings:     {
//       stemPreset: null | 'mute-stem'
//       stemId:     null | 'vocals' | 'guitar' | 'bass' | 'drums' | 'other'
//       mutedStems: string[]
//       showLyrics: boolean
//       showChords: boolean
//       showNotes:  boolean
//     }
//     lastPosition: <number>          // seconds, last known playhead
//     startedAt:    <number>          // epoch ms
//     updatedAt:    <number>          // epoch ms
//     version:      1
//   }
//
// API: GLStore.PracticeSession.{ get, has, start, update, touch, clear, describe }
//
// Design decisions (autonomous, 2026-05-09):
//   - Single session at a time. Opening a different song via start() overwrites.
//     Same song via start() resets mode + config (treat as new intent).
//   - No auto-expiry. describe() shows age; user decides if old.
//   - update() shallow-merges patch into session and re-saves immediately.
//     Debounced 250ms internally to avoid thrashing localStorage on rapid
//     loop changes.
//   - touch() bumps updatedAt without changing other fields. Cheap heartbeat
//     used by chart overlay every 30s while session is active.
//   - No Firebase mirror in v1 — local-only. Cross-device resume can come
//     later behind a feature flag.
//   - Emits 'practiceSessionChanged' on the GLStore event bus when state
//     changes so consumers (Practice entry screen Resume chip) can re-render.
//
// EXPOSES: window.GLStore.PracticeSession
// DEPENDS ON: window.GLStore (event bus via emit/on)
// ─────────────────────────────────────────────────────────────────────────────
(function() {
    'use strict';

    var STORAGE_KEY = 'gl_practice_session_v1';
    var CURRENT_VERSION = 1;
    var SAVE_DEBOUNCE_MS = 250;

    var _pendingSaveTimer = null;
    var _pendingSession = null;

    function _now() { return Date.now(); }

    function _emit(name, payload) {
        if (typeof window.GLStore !== 'undefined' && typeof window.GLStore.emit === 'function') {
            try { window.GLStore.emit(name, payload || {}); } catch (e) {}
        }
    }

    function _readRaw() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (parsed.version !== CURRENT_VERSION) return null;
            if (!parsed.songId || !parsed.mode) return null;
            return parsed;
        } catch (e) {
            console.warn('[PracticeSession] read failed:', e && e.message);
            return null;
        }
    }

    function _writeRaw(session) {
        try {
            if (session === null) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            }
        } catch (e) {
            console.warn('[PracticeSession] write failed:', e && e.message);
        }
    }

    function _flushPendingSave() {
        if (_pendingSaveTimer) {
            clearTimeout(_pendingSaveTimer);
            _pendingSaveTimer = null;
        }
        if (_pendingSession) {
            _writeRaw(_pendingSession);
            _emit('practiceSessionChanged', { session: _pendingSession });
            _pendingSession = null;
        }
    }

    function _scheduleSave(session) {
        _pendingSession = session;
        if (_pendingSaveTimer) clearTimeout(_pendingSaveTimer);
        _pendingSaveTimer = setTimeout(_flushPendingSave, SAVE_DEBOUNCE_MS);
    }

    function _defaultSettings() {
        return {
            stemPreset: null,
            stemId: null,
            mutedStems: [],
            showLyrics: true,
            showChords: true,
            showNotes: false
        };
    }

    function _defaultsForMode(mode) {
        var s = _defaultSettings();
        switch (mode) {
            case 'harmony':
                s.stemPreset = 'mute-stem';
                s.stemId = 'vocals';
                s.showLyrics = true;
                s.showChords = false;
                break;
            case 'learn':
                s.showLyrics = true;
                s.showChords = true;
                break;
            case 'chart':
                s.showLyrics = true;
                s.showChords = true;
                break;
            case 'part':
                s.stemPreset = 'mute-stem';
                break;
            case 'focus':
            default:
                break;
        }
        return s;
    }

    function _formatAge(epochMs) {
        if (!epochMs) return '';
        var diff = _now() - epochMs;
        if (diff < 60 * 1000) return 'just now';
        if (diff < 60 * 60 * 1000) {
            var mins = Math.floor(diff / 60000);
            return mins + ' min ago';
        }
        if (diff < 24 * 60 * 60 * 1000) {
            var hrs = Math.floor(diff / 3600000);
            return hrs + (hrs === 1 ? ' hr' : ' hrs') + ' ago';
        }
        var days = Math.floor(diff / 86400000);
        if (days < 7) return days + (days === 1 ? ' day' : ' days') + ' ago';
        var weeks = Math.floor(days / 7);
        if (weeks < 5) return weeks + (weeks === 1 ? ' week' : ' weeks') + ' ago';
        var months = Math.floor(days / 30);
        return months + (months === 1 ? ' month' : ' months') + ' ago';
    }

    function _formatSection(section) {
        if (!section || typeof section.in !== 'number' || typeof section.out !== 'number') return '';
        var fmt = function(s) {
            var m = Math.floor(s / 60);
            var sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        };
        return fmt(section.in) + '-' + fmt(section.out);
    }

    var _modeLabels = {
        focus:   'Focus',
        part:    'Part',
        harmony: 'Harmony',
        learn:   'Learn',
        chart:   'Chart'
    };

    // ── Public API ────────────────────────────────────────────────────────────

    function get() {
        if (_pendingSession) return _pendingSession;
        return _readRaw();
    }

    function has() {
        var s = get();
        return !!(s && s.songId);
    }

    function start(songId, mode, opts) {
        if (!songId) return null;
        mode = (_modeLabels[mode] ? mode : 'focus');
        opts = opts || {};

        var existing = get();
        var sameSong = existing && existing.songId === songId;

        var session;
        if (sameSong) {
            // Same song — reset mode + settings to the new intent but preserve
            // section + lastPosition so the user doesn't lose their loop point
            // when they reselect the same song from the picker.
            session = {
                songId: songId,
                songTitle: opts.songTitle || existing.songTitle || songId,
                section: ('section' in opts) ? opts.section : (existing.section || null),
                mode: mode,
                settings: opts.settings ? Object.assign({}, _defaultsForMode(mode), opts.settings)
                                        : _defaultsForMode(mode),
                lastPosition: ('lastPosition' in opts) ? opts.lastPosition : (existing.lastPosition || 0),
                startedAt: existing.startedAt || _now(),
                updatedAt: _now(),
                version: CURRENT_VERSION
            };
        } else {
            // Different song — fresh session, blow away the old one.
            session = {
                songId: songId,
                songTitle: opts.songTitle || songId,
                section: opts.section || null,
                mode: mode,
                settings: Object.assign({}, _defaultsForMode(mode), opts.settings || {}),
                lastPosition: opts.lastPosition || 0,
                startedAt: _now(),
                updatedAt: _now(),
                version: CURRENT_VERSION
            };
        }

        // Immediate save (not debounced) — start() is a deliberate action.
        _flushPendingSave();
        _writeRaw(session);
        _emit('practiceSessionChanged', { session: session });
        console.log('[PracticeSession] start', songId, 'mode=' + mode, sameSong ? '(same song)' : '(fresh)');
        return session;
    }

    function update(patch) {
        if (!patch || typeof patch !== 'object') return null;
        var current = get();
        if (!current) return null;
        var merged = Object.assign({}, current, patch, { updatedAt: _now() });
        // Deep-merge settings if both present
        if (patch.settings && current.settings) {
            merged.settings = Object.assign({}, current.settings, patch.settings);
        }
        _scheduleSave(merged);
        return merged;
    }

    function touch() {
        var current = get();
        if (!current) return null;
        var bumped = Object.assign({}, current, { updatedAt: _now() });
        _scheduleSave(bumped);
        return bumped;
    }

    function clear() {
        _flushPendingSave();
        _writeRaw(null);
        _pendingSession = null;
        _emit('practiceSessionChanged', { session: null });
        console.log('[PracticeSession] cleared');
    }

    function describe() {
        var s = get();
        if (!s) return null;
        var sectionLabel = _formatSection(s.section);
        var modeLabel = _modeLabels[s.mode] || s.mode;
        return {
            songTitle: s.songTitle || s.songId,
            sectionLabel: sectionLabel,
            modeLabel: modeLabel,
            ageStr: _formatAge(s.updatedAt)
        };
    }

    // ── Quick critique notes (Phase A — Workbench Notes integration) ────────
    //
    // Personal notes captured DURING a practice session ("the bridge drag",
    // "guitar solo enters too hot", "lyric in v2 is wrong"). Stored under the
    // signed-in user, not the band, so they survive across sessions for the
    // same song without leaking into band-shared notes.
    //
    // Source of truth is GLNotes (scope = 'personal_critique'). PracticeSession
    // tags each note with the current sessionStartedAt + mode so future
    // session-history views can group them.
    //
    // No-op if GLNotes isn't loaded (defensive — module should always be loaded
    // before PracticeSession in current load order, but this keeps the API
    // safe to call from anywhere).

    function addNote(text) {
        if (!text || !String(text).trim()) return Promise.resolve(false);
        var current = get();
        if (!current || !current.songTitle) {
            console.warn('[PracticeSession] addNote: no active session');
            return Promise.resolve(false);
        }
        if (typeof window.GLNotes === 'undefined' || typeof window.GLNotes.write !== 'function') {
            console.warn('[PracticeSession] addNote: GLNotes not available');
            return Promise.resolve(false);
        }
        var opts = {
            sessionStartedAt: current.startedAt || _now(),
            mode: current.mode || 'focus'
        };
        // Bump session updatedAt so the Resume chip reflects activity.
        touch();
        return window.GLNotes.write(current.songTitle, 'personal_critique', text, opts);
    }

    function getNotes() {
        var current = get();
        if (!current || !current.songTitle) return Promise.resolve([]);
        if (typeof window.GLNotes === 'undefined' || typeof window.GLNotes.read !== 'function') {
            return Promise.resolve([]);
        }
        return window.GLNotes.read(current.songTitle, 'personal_critique');
    }

    // Attach to GLStore. Wait for GLStore to exist (script load order should
    // already guarantee this since gl-practice-session.js loads after
    // groovelinx_store.js).
    function _attach() {
        if (typeof window.GLStore === 'undefined') {
            // Defer to next tick if store isn't loaded yet
            setTimeout(_attach, 0);
            return;
        }
        window.GLStore.PracticeSession = {
            get:      get,
            has:      has,
            start:    start,
            update:   update,
            touch:    touch,
            clear:    clear,
            describe: describe,
            addNote:  addNote,
            getNotes: getNotes
        };
        console.log('[PracticeSession] attached to GLStore');
    }
    _attach();

    // Flush pending writes on unload so we don't lose the last loop tweak.
    window.addEventListener('beforeunload', _flushPendingSave);
})();
