// ============================================================================
// js/core/gl-chart-renderer.js — Unified Chart Renderer (Phase B of the
// Song Workbench unification, per 02_GrooveLinx/specs/song_workbench_architecture_audit.md §8.4)
//
// Single source of truth for:
//   - Chart text caching (localStorage `gl_chart_*` keys)
//   - HTML-entity decoding of stored chart bodies
//   - HTML escape of rendered chart text
//   - Standard "empty / load-failed / chart" rendering for song-detail
//
// B.1 (THIS BUILD): wraps the song-detail Band lens. Other surfaces
// (rehearsal-mode chart, charts.js setlist accordion, charts.js master
// toggle) are still using their own paths — they migrate in B.2 / B.3 / B.4.
//
// Backwards-compatible: every consumer keeps a `typeof window.ChartRenderer
// === 'undefined'` legacy-fallback branch so a cached service-worker shell
// without this module still works (same pattern Phase A used for GLNotes).
//
// DEPENDS ON: loadBandDataFromDrive, sanitizeFirebasePath (global helpers
// already loaded from utils + firebase-service before this module).
//
// SYSTEM LOCKS preserved: this module reads from but never re-emits
// GL_PAGE_READY, never bypasses GLStore status helpers, never re-emits
// focusChanged. It is a pure renderer/cache layer.
// ============================================================================

'use strict';

window.ChartRenderer = (function () {
    var CACHE_PREFIX = 'gl_chart_';

    function _sanitize(songTitle) {
        return (typeof sanitizeFirebasePath === 'function')
            ? sanitizeFirebasePath(songTitle)
            : songTitle;
    }

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _decode(s) {
        if (s && typeof window.glDecodeHtmlEntities === 'function') {
            return window.glDecodeHtmlEntities(s);
        }
        return s;
    }

    // ── Cache: localStorage gl_chart_<sanitizedKey> ─────────────────────
    // Returns the cached chart text (string) or null.
    function getCached(songTitle) {
        if (!songTitle) return null;
        try {
            return localStorage.getItem(CACHE_PREFIX + _sanitize(songTitle));
        } catch (e) { return null; }
    }

    // Persist a chart body to localStorage. Best-effort; storage quota
    // failures are swallowed.
    function setCached(songTitle, text) {
        if (!songTitle || !text) return;
        try {
            localStorage.setItem(CACHE_PREFIX + _sanitize(songTitle), text);
        } catch (e) {}
    }

    // ── Firebase fetch ──────────────────────────────────────────────────
    // Returns { text, loaded } where loaded:false means the network/Firebase
    // call threw — caller can render a "Couldn't load" / Retry UI.
    async function loadFromFirebase(songTitle) {
        if (typeof loadBandDataFromDrive !== 'function') {
            return { text: null, loaded: false };
        }
        try {
            var data = await loadBandDataFromDrive(songTitle, 'chart');
            var text = (data && data.text && String(data.text).trim()) ? data.text : null;
            return { text: text, loaded: true };
        } catch (e) {
            return { text: null, loaded: false };
        }
    }

    // ── Multi-source fetch (used by rehearsal-mode) ─────────────────────
    // Rehearsal-mode falls back through three legacy paths:
    //   1. 'chart'           → modern path; returns { text: '...' }
    //   2. 'rehearsal_crib'  → legacy; returns raw string
    //   3. 'gig_notes'       → very-legacy; returns array, joined w/ \n
    // Each source has a different shape, so this returns the raw results
    // array — caller picks the first non-empty using its own shape rules.
    // All requests fire in parallel.
    async function loadFromFirebaseMulti(songTitle, sources) {
        if (!sources || !sources.length) return [];
        if (typeof loadBandDataFromDrive !== 'function') {
            return sources.map(function(){ return null; });
        }
        return Promise.all(sources.map(function(src) {
            return loadBandDataFromDrive(songTitle, src).catch(function(){ return null; });
        }));
    }

    // ── Render: chart body as styled HTML ───────────────────────────────
    // Opts: { fontSize:px, lineHeight, maxHeight, color, fontFamily, letterSpacing }
    // maxHeight: pass 'none' to disable scrolling (Play Mode lens does this so
    //   the chart flows the full card height without an inner scrollbar).
    // letterSpacing: defaults to '0.01em'; Play Mode lens passes '0.02em'.
    function renderHtml(chartText, opts) {
        opts = opts || {};
        if (!chartText) return '';
        var decoded = _decode(chartText);
        var fontSize  = opts.fontSize  || 13;
        var lineHt    = opts.lineHeight || 1.7;
        var maxHeight = opts.maxHeight || '400px';
        var color     = opts.color     || '#e2e8f0';
        var fontFam   = opts.fontFamily || "'Courier New', monospace";
        var letterSp  = opts.letterSpacing || '0.01em';
        return '<pre style="white-space:pre-wrap;font-family:' + fontFam +
            ';font-size:' + fontSize + 'px;line-height:' + lineHt +
            ';color:' + color +
            ';margin:0;letter-spacing:' + letterSp +
            ';max-height:' + maxHeight +
            ';overflow-y:auto">' + _esc(decoded) + '</pre>';
    }

    // ── Render: standard "no chart" / "load failed" empty states ─────────
    // Opts:
    //   loadFailed: bool — show retry banner instead of "no chart yet"
    //   safeSong:  pre-escaped (single-quote-escaped) song title for
    //              inline onclick handlers
    //   onAddChart: function-call string. Default 'openWorkbenchChartEditor'
    //               (legacy default 'openRehearsalMode' is deprecated)
    //   onRetry:   function-call string. Default 'renderSongDetail'
    function renderEmptyState(opts) {
        opts = opts || {};
        var safeSong = opts.safeSong || '';
        var onAdd    = opts.onAddChart || 'openWorkbenchChartEditor';
        var onRetry  = opts.onRetry    || 'renderSongDetail';
        if (opts.loadFailed) {
            return '<div class="sd-card" style="text-align:center;padding:24px;border-color:rgba(251,191,36,0.25);background:rgba(251,191,36,0.04)">'
                + '<div style="font-size:1.4em;margin-bottom:8px">⚠</div>'
                + '<div style="font-size:0.88em;font-weight:700;color:#fbbf24;margin-bottom:4px">Couldn’t load chart</div>'
                + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px">Network hiccup or Firebase slow to respond. The chart may still exist.</div>'
                + '<button class="sd-pm-btn" onclick="' + onRetry + '(\'' + safeSong + '\')">Retry</button>'
                + '</div>';
        }
        return '<div class="sd-card" style="text-align:center;padding:24px;border-color:rgba(99,102,241,0.12)">'
            + '<div style="font-size:1.4em;margin-bottom:8px">📝</div>'
            + '<div style="font-size:0.88em;font-weight:700;color:var(--text);margin-bottom:4px">No chart yet</div>'
            + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px">Paste or type a chart in rehearsal mode</div>'
            + '<button class="sd-pm-btn" onclick="' + onAdd + '(\'' + safeSong + '\')">📝 Add Chart</button>'
            + '</div>';
    }

    return {
        // Cache
        getCached: getCached,
        setCached: setCached,
        // Loading
        loadFromFirebase: loadFromFirebase,
        loadFromFirebaseMulti: loadFromFirebaseMulti,
        // Rendering
        renderHtml: renderHtml,
        renderEmptyState: renderEmptyState,
        // Constants exposed for migration verification + future B.3-B.4 work
        _CACHE_PREFIX: CACHE_PREFIX
    };
})();
