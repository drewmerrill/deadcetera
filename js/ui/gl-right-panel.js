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

    // Reset panel state
    _currentSong = null;

    // Restore glSongDetailBack to its original navigation behaviour
    // (panel override is only valid while a song is open in the panel).
    window.glSongDetailBack = function () {
      if (typeof showPage === 'function') showPage('songs');
    };

    renderBandSnapshot();
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
   * Minimal: just a "select a song" prompt for now.
   * Phase H will flesh this out with band-level aggregate data.
   */
  function renderBandSnapshot() {
    if (!_content) return;
    if (_title) _title.textContent = 'DeadCetera';

    var bandSlug = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem('glActiveBand') || 'deadcetera')
      : 'deadcetera';

    _content.innerHTML = [
      '<div style="',
        'padding:32px 20px;',
        'text-align:center;',
        'color:var(--text-dim,#64748b);',
        'font-size:0.88em;',
        'height:100%;',
        'display:flex;',
        'flex-direction:column;',
        'align-items:center;',
        'justify-content:center;',
        'gap:10px;',
      '">',
        '<div style="font-size:2.4em;opacity:0.5">🎸</div>',
        '<div style="font-weight:700;font-size:1em;color:var(--text-muted,#94a3b8)">',
          'Select a song',
        '</div>',
        '<div style="font-size:0.82em;max-width:200px;line-height:1.5;opacity:0.7">',
          'Click any song in the list to open it here',
        '</div>',
      '</div>',
    ].join('');
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
