/**
 * gl-now-playing.js — Milestone 4 Phase 3
 * Persistent "Now Playing" bottom bar for continuous song context.
 *
 * RESPONSIBILITIES:
 *   - Render the Now Playing bar into #gl-now-playing
 *   - Subscribe to GLStore nowPlayingChanged to show/hide + update content
 *   - Click bar → open song in right panel via GLStore.selectSong()
 *   - Close button → GLStore.setNowPlaying(null)
 *
 * RULES:
 *   - nowPlayingSongId is separate from selectedSongId and liveRehearsalSongId
 *   - Closing the right panel does NOT clear nowPlayingSongId
 *   - Only explicit user actions set or clear nowPlayingSongId
 *
 * LOAD ORDER: after groovelinx_store.js, before app-dev.js
 */

(function () {
  'use strict';

  var _bar = null;
  var _shell = null;

  window.glNowPlaying = {
    init: init,
    refresh: refresh,
  };

  function init() {
    _bar = document.getElementById('gl-now-playing');
    _shell = document.getElementById('gl-shell');
    if (!_bar) return;

    if (typeof GLStore !== 'undefined') {
      GLStore.subscribe('nowPlayingChanged', function () {
        refresh();
      });
      GLStore.subscribe('appModeChanged', function (payload) {
        var root = document.getElementById('gl-overlay-root');
        if (root) root.style.display = (payload.mode === 'performance') ? 'none' : '';
      });
      // Initial render from persisted state
      refresh();
    }

    console.log('✅ glNowPlaying initialised');
  }

  function refresh() {
    if (!_bar || !_shell) return;
    var songId = (typeof GLStore !== 'undefined' && GLStore.getNowPlaying) ? GLStore.getNowPlaying() : null;

    if (!songId) {
      _bar.style.display = 'none';
      _shell.classList.remove('gl-shell--now-playing');
      _bar.innerHTML = '';
      return;
    }

    // Gather lightweight metadata if available (no new data plumbing)
    var intel = (typeof GLStore !== 'undefined' && GLStore.getSongIntelligence)
      ? GLStore.getSongIntelligence(songId) : null;
    var metaParts = [];
    if (intel && intel.avg > 0) metaParts.push(intel.avg + '/5');
    // Song object for key/bpm
    var songObj = (typeof allSongs !== 'undefined')
      ? allSongs.find(function (s) { return s.title === songId; }) : null;
    if (songObj && songObj.key) metaParts.push(songObj.key);
    if (songObj && songObj.bpm) metaParts.push(songObj.bpm + ' BPM');
    var metaStr = metaParts.join(' · ');

    var safeTitle = _esc(songId);
    var safeTitleAttr = songId.replace(/'/g, "\\'");

    _bar.innerHTML =
      '<div class="gl-np-song" onclick="glNowPlaying._openSong(\'' + safeTitleAttr + '\')">'
      + '<span class="gl-np-icon">🎵</span>'
      + '<span class="gl-np-title">' + safeTitle + '</span>'
      + '</div>'
      + (metaStr ? '<span class="gl-np-meta">' + _esc(metaStr) + '</span>' : '')
      + '<button class="gl-np-action" onclick="glNowPlaying._openSong(\'' + safeTitleAttr + '\')">Open</button>'
      + '<button class="gl-np-close" onclick="event.stopPropagation();glNowPlaying._clear()" title="Clear now playing">✕</button>';

    _bar.style.display = 'flex';
    _shell.classList.add('gl-shell--now-playing');
  }

  // ── Actions (exposed on glNowPlaying for onclick) ─────────────────────

  window.glNowPlaying._openSong = function (title) {
    if (!title) return;
    // Navigate to songs page and select the song
    if (typeof showPage === 'function') {
      var page = (typeof GLStore !== 'undefined' && GLStore.getActivePage) ? GLStore.getActivePage() : null;
      if (page !== 'songs') showPage('songs');
    }
    if (typeof GLStore !== 'undefined' && GLStore.selectSong) {
      GLStore.selectSong(title);
      if (typeof highlightSelectedSongRow === 'function') highlightSelectedSongRow(title);
    }
  };

  window.glNowPlaying._clear = function () {
    if (typeof GLStore !== 'undefined' && GLStore.setNowPlaying) {
      GLStore.setNowPlaying(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Auto-init ─────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
