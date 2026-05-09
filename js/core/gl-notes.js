// ─────────────────────────────────────────────────────────────────────────────
// gl-notes.js — Unified notes API across the Song Workbench
//
// Phase A of the Song Workbench unification (2026-05-09). One write/read
// surface for chart, rehearsal, gig, personal_critique, and stem notes. Each
// scope adapter routes to its existing Firebase path so readers untouched by
// this PR keep working unchanged.
//
// Why this exists:
//   Today five notes UIs each call Firebase directly with their own field
//   shapes. That fragmentation blocks the Workbench from showing "all notes
//   for this song" in one panel later. This module funnels every write
//   through one entry point without forcing a backing-store migration —
//   chart_overlay_notes still lives at chart_overlay_notes, rehearsal_notes
//   at rehearsal_notes, and so on.
//
// API:
//   GLNotes.SCOPES                       → array of valid scope names
//   GLNotes.write(songTitle, scope, text, opts) → Promise<boolean>
//   GLNotes.read(songTitle, scope?)      → Promise<items[] | { scope, items[] }[]>
//   GLNotes.remove(songTitle, scope, index) → Promise<boolean>
//   GLNotes.subscribe(songTitle, callback) → unsubscribe fn (best-effort)
//
// Known unmigrated path (deferred to a later phase):
//   - app.js gig notes (saveGigNotes) write raw strings, not objects.
//     Migrating to scope 'gig' requires a renderer-side shape adapter so
//     existing string-format notes still display. Out of scope for Phase A
//     — this PR's goal is "no behavior change for existing notes."
//
// Scope adapters (do NOT change existing readers — these write the SAME
// field shape that legacy readers expect):
//   chart             → bands/{slug}/songs/{title}/chart_overlay_notes
//                       shape: { text, createdAt, createdBy }
//   rehearsal         → bands/{slug}/songs/{title}/rehearsal_notes
//                       shape: { text, author, date, priority }
//   gig               → bands/{slug}/songs/{title}/gig_notes
//                       shape: { text, author, date, gigId? }
//   personal_critique → users/{uid}/song_notes/{slug}
//                       shape: { text, createdAt, sessionStartedAt?, mode? }
//   stem              → bands/{slug}/songs/{title}/stem_critique_notes
//                       shape: { text, stemId, timestampSec?, author, createdAt }
//
// Future-ready (not implemented in this PR — keep API shapes stable):
//   - section/timestamp anchoring via opts.section / opts.timestampSec
//   - resolved/archived flag via opts.resolved
//   - cross-scope subscribe with audience filtering
//
// EXPOSES: window.GLNotes
// DEPENDS ON: window.loadBandDataFromDrive, window.saveBandDataToDrive,
//             window.firebaseDB (optional — only personal_critique writes
//             use it directly), window.bandPath, window.sanitizeFirebasePath,
//             window.currentUserEmail (optional), window.getCurrentMemberKey
//             (optional)
// ─────────────────────────────────────────────────────────────────────────────
(function (global) {
    'use strict';

    var SCOPES = ['chart', 'rehearsal', 'gig', 'personal_critique', 'stem'];

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _author() {
        if (typeof global.getCurrentMemberKey === 'function') {
            try {
                var k = global.getCurrentMemberKey();
                if (k) return k;
            } catch (e) {}
        }
        if (typeof global.currentUserEmail !== 'undefined' && global.currentUserEmail) {
            return global.currentUserEmail;
        }
        return '';
    }

    function _uid() {
        // Personal_critique notes key off the signed-in user. We don't have a
        // first-class uid in this app — the email serves as the per-user key
        // (sanitized so it's a valid Firebase path segment).
        var email = (typeof global.currentUserEmail !== 'undefined' && global.currentUserEmail)
            ? global.currentUserEmail
            : '';
        if (!email) return null;
        return email.replace(/[.#$/\[\]]/g, '_');
    }

    function _slug(songTitle) {
        if (typeof global.sanitizeFirebasePath === 'function') {
            try { return global.sanitizeFirebasePath(songTitle); } catch (e) {}
        }
        return (songTitle || '').replace(/[^a-zA-Z0-9]/g, '_');
    }

    function _toArr(v) {
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object') return Object.values(v);
        return [];
    }

    function _toast(msg) {
        if (typeof global.showToast === 'function') {
            try { global.showToast(msg); } catch (e) {}
        }
    }

    // ── Scope adapters ───────────────────────────────────────────────────────
    //
    // Each adapter knows three things: how to read the existing array, how to
    // shape a new note record (so legacy readers keep working), and where to
    // write it. Reads always return an array; writes always append to that
    // array and re-save.

    var ADAPTERS = {

        chart: {
            read: function (songTitle) {
                if (typeof global.loadBandDataFromDrive !== 'function') return Promise.resolve([]);
                return global.loadBandDataFromDrive(songTitle, 'chart_overlay_notes')
                    .then(_toArr)
                    .catch(function () { return []; });
            },
            shape: function (text, opts) {
                return {
                    text: text,
                    createdAt: new Date().toISOString(),
                    createdBy: (typeof global.currentUserEmail !== 'undefined') ? global.currentUserEmail : ''
                };
            },
            write: function (songTitle, items) {
                if (typeof global.saveBandDataToDrive !== 'function') return Promise.reject(new Error('saveBandDataToDrive missing'));
                return global.saveBandDataToDrive(songTitle, 'chart_overlay_notes', items);
            }
        },

        rehearsal: {
            read: function (songTitle) {
                if (typeof global.loadBandDataFromDrive !== 'function') return Promise.resolve([]);
                return global.loadBandDataFromDrive(songTitle, 'rehearsal_notes')
                    .then(_toArr)
                    .catch(function () { return []; });
            },
            shape: function (text, opts) {
                return {
                    text: text,
                    author: _author(),
                    date: new Date().toISOString(),
                    priority: (opts && opts.priority) || 'normal'
                };
            },
            write: function (songTitle, items) {
                // Prefer GLStore.saveSongData when available (matches legacy
                // rmSaveNote behavior — store-routed writes get cache + event
                // emission). Fall back to direct Firebase write otherwise.
                if (typeof global.GLStore !== 'undefined' && typeof global.GLStore.saveSongData === 'function') {
                    return global.GLStore.saveSongData(songTitle, 'rehearsal_notes', items);
                }
                if (typeof global.saveBandDataToDrive !== 'function') return Promise.reject(new Error('saveBandDataToDrive missing'));
                return global.saveBandDataToDrive(songTitle, 'rehearsal_notes', items);
            }
        },

        gig: {
            read: function (songTitle) {
                if (typeof global.loadBandDataFromDrive !== 'function') return Promise.resolve([]);
                return global.loadBandDataFromDrive(songTitle, 'gig_notes')
                    .then(_toArr)
                    .catch(function () { return []; });
            },
            shape: function (text, opts) {
                var rec = {
                    text: text,
                    author: _author(),
                    date: new Date().toISOString()
                };
                if (opts && opts.gigId) rec.gigId = opts.gigId;
                return rec;
            },
            write: function (songTitle, items) {
                if (typeof global.saveBandDataToDrive !== 'function') return Promise.reject(new Error('saveBandDataToDrive missing'));
                return global.saveBandDataToDrive(songTitle, 'gig_notes', items);
            }
        },

        personal_critique: {
            read: function (songTitle) {
                var uid = _uid();
                if (!uid) return Promise.resolve([]);
                if (typeof global.firebaseDB === 'undefined' || !global.firebaseDB) {
                    return Promise.resolve(_localPersonalRead(uid, songTitle));
                }
                var path = 'users/' + uid + '/song_notes/' + _slug(songTitle);
                return global.firebaseDB.ref(path).once('value')
                    .then(function (snap) {
                        var arr = _toArr(snap.val());
                        // Mirror to local cache for offline reads
                        try { _localPersonalWrite(uid, songTitle, arr); } catch (e) {}
                        return arr;
                    })
                    .catch(function () { return _localPersonalRead(uid, songTitle); });
            },
            shape: function (text, opts) {
                var rec = {
                    text: text,
                    createdAt: new Date().toISOString()
                };
                if (opts && opts.sessionStartedAt) rec.sessionStartedAt = opts.sessionStartedAt;
                if (opts && opts.mode) rec.mode = opts.mode;
                return rec;
            },
            write: function (songTitle, items) {
                var uid = _uid();
                if (!uid) return Promise.reject(new Error('Not signed in — personal notes need a user'));
                // Always cache locally first so the note survives Firebase
                // hiccups and offline use.
                try { _localPersonalWrite(uid, songTitle, items); } catch (e) {}
                if (typeof global.firebaseDB === 'undefined' || !global.firebaseDB) {
                    return Promise.resolve(true);
                }
                var path = 'users/' + uid + '/song_notes/' + _slug(songTitle);
                return global.firebaseDB.ref(path).set(items).then(function () { return true; });
            }
        },

        stem: {
            read: function (songTitle) {
                if (typeof global.loadBandDataFromDrive !== 'function') return Promise.resolve([]);
                return global.loadBandDataFromDrive(songTitle, 'stem_critique_notes')
                    .then(_toArr)
                    .catch(function () { return []; });
            },
            shape: function (text, opts) {
                opts = opts || {};
                var rec = {
                    text: text,
                    stemId: opts.stemId || '',
                    author: _author(),
                    createdAt: new Date().toISOString()
                };
                if (typeof opts.timestampSec === 'number') rec.timestampSec = opts.timestampSec;
                return rec;
            },
            write: function (songTitle, items) {
                if (typeof global.saveBandDataToDrive !== 'function') return Promise.reject(new Error('saveBandDataToDrive missing'));
                return global.saveBandDataToDrive(songTitle, 'stem_critique_notes', items);
            }
        }
    };

    // Local cache for personal_critique notes (Firebase fallback + offline)
    function _personalCacheKey(uid, songTitle) {
        return 'gl_personal_notes_' + uid + '_' + _slug(songTitle);
    }
    function _localPersonalRead(uid, songTitle) {
        try {
            var raw = localStorage.getItem(_personalCacheKey(uid, songTitle));
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function _localPersonalWrite(uid, songTitle, items) {
        try {
            localStorage.setItem(_personalCacheKey(uid, songTitle), JSON.stringify(items || []));
        } catch (e) {}
    }

    // ── Public API ───────────────────────────────────────────────────────────

    function _validateScope(scope) {
        if (SCOPES.indexOf(scope) < 0) {
            throw new Error('GLNotes: unknown scope "' + scope + '". Valid: ' + SCOPES.join(', '));
        }
    }

    function write(songTitle, scope, text, opts) {
        _validateScope(scope);
        if (!songTitle) return Promise.reject(new Error('GLNotes.write: songTitle required'));
        if (!text || !String(text).trim()) return Promise.resolve(false);
        var trimmed = String(text).trim();
        var adapter = ADAPTERS[scope];
        return adapter.read(songTitle).then(function (items) {
            var arr = _toArr(items).slice();
            arr.push(adapter.shape(trimmed, opts || {}));
            return adapter.write(songTitle, arr).then(function () {
                _emit(songTitle, scope, arr);
                return true;
            });
        }).catch(function (e) {
            console.warn('[GLNotes] write failed', scope, songTitle, e && e.message);
            return false;
        });
    }

    // Remove a single note from a scope by its current array index. Reads
    // the array, splices, and re-saves through the same scope adapter.
    // Returns true on success, false if the index was out of range or the
    // write failed.
    function remove(songTitle, scope, index) {
        _validateScope(scope);
        if (!songTitle) return Promise.reject(new Error('GLNotes.remove: songTitle required'));
        if (typeof index !== 'number' || index < 0) return Promise.resolve(false);
        var adapter = ADAPTERS[scope];
        return adapter.read(songTitle).then(function (items) {
            var arr = _toArr(items).slice();
            if (index >= arr.length) return false;
            arr.splice(index, 1);
            return adapter.write(songTitle, arr).then(function () {
                _emit(songTitle, scope, arr);
                return true;
            });
        }).catch(function (e) {
            console.warn('[GLNotes] remove failed', scope, songTitle, e && e.message);
            return false;
        });
    }

    // Read one scope: returns an array of items.
    // Read all scopes: returns an array of { scope, items } so callers can
    // render an aggregated view without each one re-issuing five fetches.
    function read(songTitle, scope) {
        if (scope) {
            _validateScope(scope);
            return ADAPTERS[scope].read(songTitle);
        }
        var promises = SCOPES.map(function (s) {
            return ADAPTERS[s].read(songTitle).then(function (items) {
                return { scope: s, items: _toArr(items) };
            });
        });
        return Promise.all(promises);
    }

    // Best-effort subscribe via the GLStore event bus. Phase B may upgrade
    // this to a real Firebase listener per scope; for now subscribers receive
    // a payload after every successful write done through GLNotes.
    var _subscribers = {};
    function subscribe(songTitle, callback) {
        if (typeof callback !== 'function') return function () {};
        var key = _slug(songTitle);
        if (!_subscribers[key]) _subscribers[key] = [];
        _subscribers[key].push(callback);
        return function unsubscribe() {
            var arr = _subscribers[key] || [];
            var idx = arr.indexOf(callback);
            if (idx >= 0) arr.splice(idx, 1);
        };
    }

    function _emit(songTitle, scope, items) {
        var key = _slug(songTitle);
        var arr = _subscribers[key] || [];
        for (var i = 0; i < arr.length; i++) {
            try { arr[i]({ songTitle: songTitle, scope: scope, items: items }); } catch (e) {}
        }
        // Also broadcast on GLStore event bus so cross-module consumers can
        // react without holding direct subscribe handles.
        if (typeof global.GLStore !== 'undefined' && typeof global.GLStore.emit === 'function') {
            try { global.GLStore.emit('notesChanged', { songTitle: songTitle, scope: scope, items: items }); } catch (e) {}
        }
    }

    global.GLNotes = {
        SCOPES: SCOPES.slice(),
        write: write,
        read: read,
        remove: remove,
        subscribe: subscribe
    };

    if (typeof console !== 'undefined' && console.log) {
        console.log('📝 GLNotes loaded (' + SCOPES.length + ' scopes)');
    }
})(typeof window !== 'undefined' ? window : this);
