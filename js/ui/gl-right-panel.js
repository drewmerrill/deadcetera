// =============================================================================
// js/ui/gl-right-panel.js — Milestone 1 Phase C
// Right context panel controller for the 3-pane Band Command Center shell.
//
// RESPONSIBILITIES:
//   - Subscribe to GLStore events (gl-song-selected, gl-song-cleared)
//   - Open/close the #gl-right-panel DOM element
//   - Dispatch renderSongDetail() into #gl-right-panel-content
//   - Render a band snapshot when no entity is selected
//   - Restore workspace scroll on close
//
// MUST NOT:
//   - Call showPage() for any reason
//   - Write glLastPage to localStorage
//   - Own any Firebase reads (delegate to GLStore or renderSongDetail)
//   - Run before GLStore is loaded (load order: groovelinx_store.js → this)
//
// LOAD ORDER (in index-dev.html):
//   groovelinx_store.js  → gl-right-panel.js  → app-dev.js
//
// DEV ONLY: loaded by index-dev.html only. index.html is untouched.
// =============================================================================

(function () {
  'use strict';

  // ── DOM refs ────────────────────────────────────────────────────────────────
  // Resolved once on init(). All panel operations go through these refs.

  var _shell    = null;  // #gl-shell
  var _panel    = null;  // #gl-right-panel
  var _title    = null;  // #gl-rp-title
  var _content  = null;  // #gl-right-panel-content
  var _closeBtn = null;  // #gl-rp-close

  // ── Internal state ──────────────────────────────────────────────────────────

  var _isOpen       = false;
  var _currentSong  = null;   // title string currently rendered in the panel

  // ── Public API ──────────────────────────────────────────────────────────────

  window.glRightPanel = {
    init:              init,
    open:              open,
    close:             close,
    hide:              hide,
    renderBandSnapshot: renderBandSnapshot,
  };

  // ── Initialisation ──────────────────────────────────────────────────────────

  function init() {
    _shell    = document.getElementById('gl-shell');
    _panel    = document.getElementById('gl-right-panel');
    _title    = document.getElementById('gl-rp-title');
    _content  = document.getElementById('gl-right-panel-content');
    _closeBtn = document.getElementById('gl-rp-close');

    if (!_shell || !_panel || !_content) {
      console.warn('[glRightPanel] Required DOM elements not found — is this index-dev.html?');
      return;
    }

    // Wire close button
    if (_closeBtn) {
      _closeBtn.addEventListener('click', function () { close(); });
    }

    // ESC closes the panel
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _isOpen) { close(); }
    });

    // Subscribe to GLStore events
    if (typeof GLStore !== 'undefined' && typeof GLStore.subscribe === 'function') {
      GLStore.subscribe('gl-song-selected', function (payload) {
        if (payload && payload.title) {
          _onSongSelected(payload.title);
        }
      });

      GLStore.subscribe('gl-song-cleared', function () {
        _onSongCleared();
      });
    } else {
      console.warn('[glRightPanel] GLStore not available at init — subscriptions skipped.');
    }

    // Render initial state
    renderBandSnapshot();

    console.log('✅ glRightPanel initialised');
  }

  // ── Panel open/close ────────────────────────────────────────────────────────

  /**
   * Open the right panel.
   * Adds gl-shell--panel-open to #gl-shell — CSS handles the width animation.
   * Does NOT call showPage(). Does NOT write glLastPage.
   */
  function open() {
    if (!_shell) return;
    _shell.classList.add('gl-shell--panel-open');
    _isOpen = true;
  }

  /**
   * Close the right panel.
   * Removes gl-shell--panel-open. Restores workspace scroll via GLStore.
   * Clears current song selection via GLStore.clearSong().
   */
  function close() {
    if (!_shell) return;
    _shell.classList.remove('gl-shell--panel-open');
    _isOpen = false;

    // Restore workspace scroll to where it was before the panel opened
    if (typeof GLStore !== 'undefined' && typeof GLStore.restoreScroll === 'function') {
      GLStore.restoreScroll();
    }

    // Clear the selection — GLStore is now the single writer for this
    if (typeof GLStore !== 'undefined' && typeof GLStore.clearSong === 'function') {
      GLStore.clearSong();
    }

    // Phase G: clear glLastSong so reload does not reopen the panel
    try { localStorage.removeItem('glLastSong'); } catch(e) {}

    // Reset panel state
    _currentSong = null;

    // Restore glSongDetailBack to its original navigation behaviour
    // (panel override is only valid while a song is open in the panel).
    window.glSongDetailBack = function () {
      if (typeof showPage === 'function') showPage('songs');
    };

    renderBandSnapshot();
  }

  /**
   * Visually hide the panel without clearing selection state.
   * Used by showPage() when navigating away from songs — the selection
   * survives so returning to songs can reopen the same song.
   * Explicit close (X / ESC) still calls close() which clears everything.
   */
  function hide() {
    if (!_shell) return;
    _shell.classList.remove('gl-shell--panel-open');
    _isOpen = false;
    // Clear localStorage signal so reload doesn't flash Songs page.
    // In-memory GLStore selection survives for return-to-songs.
    try { localStorage.removeItem('glLastSong'); } catch(e) {}
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  function _onSongSelected(title) {
    if (!_content) return;

    _currentSong = title;

    // Update panel header title
    if (_title) _title.textContent = title;

    // Render song detail into the right panel content container.
    // panelMode:true suppresses the glLastPage:'songdetail' write inside
    // renderSongDetail — the workspace page has NOT changed.
    if (typeof renderSongDetail === 'function') {
      renderSongDetail(title, _content, { panelMode: true });

      // TEMPORARY PANEL-MODE COMPATIBILITY PATCH
      // song-detail.js exposes glSongDetailBack() which calls showPage('songs').
      // In panel mode that would navigate the workspace away — wrong behaviour.
      // We override it here, scoped only to this panel flow, so the ← Songs
      // button closes the panel instead. close() restores the original below.
      // This patch should be removed when song-detail.js gains native panel-mode
      // awareness (future milestone).
      window.glSongDetailBack = function () {
        close();
      };
    } else {
      // renderSongDetail not yet loaded — show a loading placeholder
      _content.innerHTML = [
        '<div style="padding:24px;text-align:center;color:var(--text-dim,#64748b);font-size:0.88em">',
        '  <div style="font-size:2em;margin-bottom:8px">🎵</div>',
        '  <div>Loading song detail…</div>',
        '</div>',
      ].join('');
    }

    // Open the panel (idempotent if already open)
    open();
  }

  function _onSongCleared() {
    _currentSong = null;
    if (_title) _title.textContent = '';
    renderBandSnapshot();
    // Panel stays open showing band snapshot — close() was called separately
    // if the user clicked ✕. Clearing selection doesn't auto-close the panel.
  }

  // ── Band snapshot (default panel content) ───────────────────────────────────

  /**
   * Render the band readiness snapshot — shown when no song is selected.
   * Milestone 3 Phase C: catalog intelligence + practice recommendations.
   */
  function renderBandSnapshot() {
    if (!_content) return;
    if (_title) _title.textContent = 'DeadCetera';

    var ci = (typeof GLStore !== 'undefined' && GLStore.getCatalogIntelligence)
      ? GLStore.getCatalogIntelligence() : null;
    var recs = (typeof GLStore !== 'undefined' && GLStore.getPracticeRecommendations)
      ? GLStore.getPracticeRecommendations({ limit: 3 }) : [];

    // Fallback if data not ready yet (early load, before auth/data)
    if (!ci || !ci.totalSongs) {
      _content.innerHTML = '<div style="padding:32px 20px;text-align:center;color:var(--text-dim,#64748b);font-size:0.88em;'
        + 'height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">'
        + '<div style="font-size:2.4em;opacity:0.5">🎸</div>'
        + '<div style="font-weight:700;font-size:1em;color:var(--text-muted,#94a3b8)">Select a song</div>'
        + '<div style="font-size:0.82em;max-width:200px;line-height:1.5;opacity:0.7">Click any song in the list to open it here</div>'
        + '</div>';
      return;
    }

    var t = ci.tiers;
    var html = '<div style="padding:16px 14px;font-size:0.88em">';

    // Catalog readiness summary
    html += '<div style="margin-bottom:16px">'
      + '<div style="font-weight:800;font-size:1em;color:var(--text,#f1f5f9);margin-bottom:8px">Band Readiness</div>'
      + '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:10px">'
      +   '<span style="font-size:1.8em;font-weight:800;color:var(--text,#f1f5f9)">' + (ci.catalogAvg || '—') + '</span>'
      +   '<span style="font-size:0.75em;font-weight:600;color:var(--text-muted,#94a3b8)">/ 5 avg across ' + ci.ratedSongs + ' rated</span>'
      + '</div>';

    // Tier breakdown
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    var tierData = [
      { count: t.locked, label: 'Locked', color: '#22c55e' },
      { count: t.almost, label: 'Almost', color: '#84cc16' },
      { count: t.needsWork, label: 'Needs Work', color: '#eab308' },
      { count: t.notReady, label: 'Not Ready', color: '#ef4444' },
    ];
    for (var i = 0; i < tierData.length; i++) {
      var td = tierData[i];
      if (td.count > 0) {
        html += '<span style="font-size:0.72em;font-weight:700;padding:2px 8px;border-radius:10px;'
          + 'background:' + td.color + '18;color:' + td.color + ';border:1px solid ' + td.color + '33">'
          + td.count + ' ' + td.label + '</span>';
      }
    }
    if (t.unrated > 0) {
      html += '<span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:10px;'
        + 'color:var(--text-dim,#475569);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">'
        + t.unrated + ' Unrated</span>';
    }
    html += '</div></div>';

    // Practice recommendations
    if (recs && recs.length > 0) {
      html += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;margin-top:4px">'
        + '<div style="font-weight:800;font-size:1em;color:var(--text,#f1f5f9);margin-bottom:10px">Practice Priority</div>';
      for (var r = 0; r < recs.length; r++) {
        var rec = recs[r];
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-radius:6px" '
          + 'onclick="GLStore.selectSong(\'' + rec.songId.replace(/'/g, "\\'") + '\')">'
          + '<span style="font-size:1.1em;font-weight:800;color:var(--text-dim,#475569);width:18px;text-align:center">' + (r + 1) + '</span>'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-weight:700;font-size:0.88em;color:var(--text,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(rec.songId) + '</div>'
          +   '<div style="font-size:0.72em;color:var(--text-dim,#475569)">' + _esc(rec.topReason || '') + '</div>'
          + '</div>'
          + '<span style="font-size:0.75em;font-weight:700;color:var(--text-muted,#94a3b8)">' + rec.avg + '/5</span>'
          + '</div>';
      }
      html += '</div>';
    }

    // Prompt to select
    html += '<div style="text-align:center;margin-top:20px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07)">'
      + '<div style="font-size:0.78em;color:var(--text-dim,#475569);opacity:0.7">Select a song for detail</div>'
      + '</div>';

    html += '</div>';
    _content.innerHTML = html;
  }

  /** Escape HTML for snapshot rendering */
  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Auto-init after DOM ready ────────────────────────────────────────────────
  // DOMContentLoaded is the right hook: all static HTML is parsed,
  // GLStore is loaded (it's declared above this in the script order),
  // but app-dev.js has not run yet. This is intentional — the panel
  // subscribes before app code fires any song selections.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Already parsed (e.g. script tag at end of body)
    init();
  }

})();
