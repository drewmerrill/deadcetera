// ============================================================================
// js/features/charts.js — Chart Overlay Notes + Now-Playing Highlight
//
// What's in this module:
//   • Overlay-note read/write/remove (routed through GLNotes — Phase A path).
//   • highlightActiveSong: marks the currently-playing song's chart row in
//     setlist/rehearsal surfaces. Used by gl-player-ui and listening-bundles.
//
// What used to be here (deleted post Phase B):
//   • chart_master / chart_band split + the inline editor / importer.
//     The split was never adopted (0/450 songs in production carry either
//     field). The future plan is one shared chart per song with toggleable
//     per-member overlays — see GitHub Issue #27.
//   • renderSetlistCharts — replaced by the future continuous-chart-mode
//     surface tracked in Issue #28. The skeleton it produced was already
//     unreferenced by any router.
//   • chart_url helpers — only callers were the deleted editor UI.
//
// Chart fetch + render now lives in js/core/gl-chart-renderer.js
// (Phase B canonical path).
//
// DEPENDS ON: loadBandDataFromDrive, saveBandDataToDrive (legacy fallback),
//             window.GLNotes (preferred path), showToast.
// ============================================================================

'use strict';

window.ChartSystem = (function() {

    // ── Overlay Notes ────────────────────────────────────────────────────────
    // Schema: bands/{slug}/songs/{title}/chart_overlay_notes
    //         → [{ text, createdAt, createdBy }]
    // GLNotes is the canonical writer; the legacy branch only fires when an
    // old service-worker shell is loaded and GLNotes hasn't arrived yet.

    async function loadOverlayNotes(songTitle) {
        try {
            var notes = await loadBandDataFromDrive(songTitle, 'chart_overlay_notes');
            return Array.isArray(notes) ? notes : (notes ? Object.values(notes) : []);
        } catch(e) { return []; }
    }

    async function addOverlayNote(songTitle, text) {
        if (!text || !text.trim()) return false;
        if (typeof window.GLNotes !== 'undefined' && typeof window.GLNotes.write === 'function') {
            try {
                var ok = await window.GLNotes.write(songTitle, 'chart', text.trim());
                if (ok) {
                    if (typeof showToast === 'function') showToast('✅ Note added to chart');
                    return true;
                }
                if (typeof showToast === 'function') showToast('⚠️ Could not save note');
                return false;
            } catch(e) {
                if (typeof showToast === 'function') showToast('⚠️ Could not save note');
                return false;
            }
        }
        // Legacy fallback (cached old shell, GLNotes not yet loaded).
        try {
            var notes = await loadOverlayNotes(songTitle);
            notes.push({
                text: text.trim(),
                createdAt: new Date().toISOString(),
                createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
            });
            await saveBandDataToDrive(songTitle, 'chart_overlay_notes', notes);
            if (typeof showToast === 'function') showToast('✅ Note added to chart');
            return true;
        } catch(e) {
            if (typeof showToast === 'function') showToast('⚠️ Could not save note');
            return false;
        }
    }

    async function removeOverlayNote(songTitle, index) {
        if (typeof window.GLNotes !== 'undefined' && typeof window.GLNotes.remove === 'function') {
            try {
                var ok = await window.GLNotes.remove(songTitle, 'chart', index);
                if (ok && typeof showToast === 'function') showToast('Note removed');
                return;
            } catch(e) { /* fall through */ }
        }
        // Legacy fallback (cached old shell).
        try {
            var notes = await loadOverlayNotes(songTitle);
            if (index >= 0 && index < notes.length) {
                notes.splice(index, 1);
                await saveBandDataToDrive(songTitle, 'chart_overlay_notes', notes);
                if (typeof showToast === 'function') showToast('Note removed');
            }
        } catch(e) {}
    }

    // ── Now Playing Highlight ────────────────────────────────────────────────
    // Highlights the currently-playing song inside any chart-list surface.
    // Pairs with the planned continuous-chart-mode surface (Issue #28).

    function highlightActiveSong(songTitle) {
        // Clear previous highlight
        document.querySelectorAll('[id^="chart_song_"]').forEach(function(el) {
            el.style.borderLeft = '';
            el.style.paddingLeft = '';
            el.style.background = '';
            var label = el.querySelector('.chart-now-playing');
            if (label) label.remove();
        });
        if (!songTitle) return;
        var els = document.querySelectorAll('[data-song]');
        for (var i = 0; i < els.length; i++) {
            if (els[i].dataset.song === songTitle) {
                els[i].style.borderLeft = '3px solid #22c55e';
                els[i].style.paddingLeft = '10px';
                els[i].style.background = 'rgba(34,197,94,0.04)';
                var label = document.createElement('div');
                label.className = 'chart-now-playing';
                label.style.cssText = 'font-size:0.68em;font-weight:700;color:#22c55e;margin-bottom:2px';
                label.textContent = '● Now playing';
                els[i].insertBefore(label, els[i].firstChild);
                var rect = els[i].getBoundingClientRect();
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    els[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                break;
            }
        }
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        loadOverlayNotes: loadOverlayNotes,
        addOverlayNote: addOverlayNote,
        removeOverlayNote: removeOverlayNote,
        highlightActiveSong: highlightActiveSong
    };

})();

console.log('🎼 charts.js loaded');
