/* =============================================================
   live-gig.js  —  GrooveLinx Live Gig Mode
   Stage-friendly full-screen performance screen.
   Reads from GLStore only. No direct Firebase calls.
   ============================================================= */

(function () {
  'use strict';

  /* ── Module-local state (no window pollution) ─────────────── */
  var _lg = {
    setlistId:  null,
    setlistName: '',
    songs:      [],   // [{title, key, bpm, notes, position, readiness, statusTag}]
    cursor:     0,
    preloaded:  {},   // { titleKey: { archive, relisten, phishin } }
    fullscreen: false,
    touchStartX: null,
    _keyHandler: null,
    _touchStartHandler: null,
    _touchEndHandler: null
  };

  /* ── Constants ────────────────────────────────────────────── */
  var MEMBER_KEYS   = ['drew', 'chris', 'brian', 'pierce', 'jay'];
  var MEMBER_LABELS = { drew: 'D', chris: 'C', brian: 'B', pierce: 'P', jay: 'J' };
  var STATUS_LABELS = { wip: 'WIP', needsPolish: 'Polish', onDeck: 'On Deck' };
  var STATUS_COLORS = { wip: '#e05a2b', needsPolish: '#d4a02a', onDeck: '#4caf74' };

  /* ─────────────────────────────────────────────────────────────
     PUBLIC: initLiveGig()
     Entry point called by showPage('live-gig')
  ───────────────────────────────────────────────────────────── */
  function initLiveGig() {
    var setlistId = window._lgLaunchSetlistId || null;
    window._lgLaunchSetlistId = null; // consume handoff

    if (!setlistId) {
      // fallback: try to find most recently viewed setlist
      setlistId = _getMostRecentSetlistId();
    }

    if (!setlistId) {
      _renderError('No setlist selected. Please choose a setlist from the Setlists page.');
      return;
    }

    _lg.setlistId = setlistId;
    _lg.cursor    = 0;

    // Hide rehearsal-mode floating buttons while Live Gig is active
    var _rmMonkey = document.getElementById('rmMonkeyBtn');
    if (_rmMonkey) _rmMonkey.style.display = 'none';
    var _rmCapture = document.getElementById('rmCaptureMomentBtn');
    if (_rmCapture) _rmCapture.style.display = 'none';
    var loaded = _loadSetlistFromStore(setlistId);
    if (!loaded) {
      _renderError('Could not load setlist "' + setlistId + '". Try again from Setlists.');
      return;
    }

    _renderStage();
    _attachInputListeners();
    _preloadLinksBackground();
    // Milestone 4: notify shell we're entering performance mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('performance');
    if (typeof glWakeLock !== 'undefined') glWakeLock.acquire('live-gig');
  }

  /* ─────────────────────────────────────────────────────────────
     PUBLIC CONTROLS (called from onclick attrs)
  ───────────────────────────────────────────────────────────── */
  function lgNext() {
    if (_lg.cursor < _lg.songs.length - 1) {
      _lg.cursor++;
      _updateSongCard();
    } else {
      _flashControl('lgNextBtn', 'End of set');
    }
  }

  function lgPrev() {
    if (_lg.cursor > 0) {
      _lg.cursor--;
      _updateSongCard();
    } else {
      _flashControl('lgPrevBtn', 'Start of set');
    }
  }

  function lgJumpTo(idx) {
    idx = parseInt(idx, 10);
    if (isNaN(idx) || idx < 0 || idx >= _lg.songs.length) return;
    _lg.cursor = idx;
    _updateSongCard();
    _closeJumpMenu();
  }

  function lgToggleFullscreen() {
    if (!document.fullscreenElement) {
      var el = document.getElementById('lgOverlay');
      if (el && el.requestFullscreen) el.requestFullscreen();
      _lg.fullscreen = true;
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      _lg.fullscreen = false;
    }
    _updateFullscreenIcon();
  }

  function lgExit() {
    _detachInputListeners();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
    _lg.fullscreen = false;
    var overlay = document.getElementById('lgOverlay');
    if (overlay) overlay.style.display = 'none';
    // Restore rehearsal-mode floating buttons
    var _rmMonkey = document.getElementById('rmMonkeyBtn');
    if (_rmMonkey) _rmMonkey.style.display = '';
    var _rmCapture = document.getElementById('rmCaptureMomentBtn');
    if (_rmCapture) _rmCapture.style.display = '';
    // Milestone 4: restore workspace mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('workspace');
    if (typeof glWakeLock !== 'undefined') glWakeLock.release('live-gig');
    // Return to setlists
    if (typeof showPage === 'function') showPage('setlists');
  }

  function lgToggleZen() {
    var overlay = document.getElementById('lgOverlay');
    if (!overlay) return;
    var isZen = overlay.classList.toggle('lg-zen');
    var zenBtn = document.getElementById('lgZenBtn');
    if (zenBtn) zenBtn.style.opacity = isZen ? '0.3' : '1';
  }
  window.lgToggleZen = lgToggleZen;

  function lgToggleJumpMenu() {
    var menu = document.getElementById('lgJumpMenu');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
      _buildJumpMenu(menu);
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }
  }

  /* ─────────────────────────────────────────────────────────────
     DATA LOADING
  ───────────────────────────────────────────────────────────── */
  function _loadSetlistFromStore(setlistId) {
    var cache = window._cachedSetlists;
    var setlist = null;

    if (cache) {
      var setlistsArr = Array.isArray(cache) ? cache : Object.values(cache);
      var idx = parseInt(setlistId, 10);
      // Match by numeric _origIdx first, then by .id string
      if (!isNaN(idx)) {
        setlist = setlistsArr[idx] || null;
      }
      if (!setlist) {
        for (var i = 0; i < setlistsArr.length; i++) {
          if (setlistsArr[i] && (setlistsArr[i].id === setlistId || setlistsArr[i].setlistId === setlistId)) {
            setlist = setlistsArr[i];
            break;
          }
        }
      }
    }
    if (!setlist) return false;

    _lg.setlistName = setlist.name || setlist.title || 'Setlist';

    // Normalise songs — setlists use sets[].songs, flatten all sets in order
    var rawSongs = [];
    if (setlist.sets && setlist.sets.length) {
      setlist.sets.forEach(function(set) {
        var setSongs = toArray(set.songs || []);
        setSongs.forEach(function(sg) {
          // songs may be strings or objects
          if (typeof sg === 'string') {
            rawSongs.push({ title: sg });
          } else if (sg && (sg.title || sg.name)) {
            rawSongs.push(sg);
          }
        });
      });
    } else {
      // fallback: flat songs or items array
      rawSongs = toArray(setlist.songs || setlist.items || []);
      rawSongs = rawSongs.map(function(sg) {
        return typeof sg === 'string' ? { title: sg } : sg;
      });
    }

    // Sort by position if available
    rawSongs.sort(function (a, b) {
      return (a.position || 0) - (b.position || 0);
    });

    // Enrich with readiness + status from GLStore caches
    var readinessAll = _safeGetAllReadiness();
    var statusAll    = _safeGetAllStatus();

    _lg.songs = rawSongs.map(function (s, idx) {
      var title     = s.title || s.name || ('Song ' + (idx + 1));
      var titleKey  = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      var readiness = (readinessAll && readinessAll[titleKey]) ? readinessAll[titleKey] : {};
      var statusTag = (statusAll && statusAll[titleKey]) ? statusAll[titleKey] : null;
      return {
        title:     title,
        titleKey:  titleKey,
        key:       s.key       || s.musicalKey || '',
        bpm:       s.bpm       || s.tempo      || null,
        notes:     s.notes     || s.note       || '',
        position:  s.position  || idx + 1,
        readiness: readiness,
        statusTag: statusTag
      };
    });

    return _lg.songs.length > 0;
  }

  function _getMostRecentSetlistId() {
    var cache = window._cachedSetlists;
    if (!cache) return null;
    var arr = Array.isArray(cache) ? cache : Object.values(cache);
    if (arr.length === 0) return null;
    // Return first one as fallback
    return arr[0] && arr[0].id ? arr[0].id : null;
  }

  function _safeGetAllReadiness() {
    if (window.GLStore && typeof GLStore.getAllReadiness === 'function') {
      return GLStore.getAllReadiness();
    }
    return window._masterReadiness || null;
  }

  function _safeGetAllStatus() {
    if (window.GLStore && typeof GLStore.getAllStatus === 'function') {
      return GLStore.getAllStatus();
    }
    return window._songStatusCache || null;
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER: Full stage overlay
  ───────────────────────────────────────────────────────────── */
  function _renderStage() {
    var overlay = document.getElementById('lgOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lgOverlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = _buildStageHTML();
    overlay.style.display = 'flex';

    // Wire jump menu close-on-outside-click
    overlay.addEventListener('click', function (e) {
      var menu = document.getElementById('lgJumpMenu');
      var btn  = document.getElementById('lgJumpBtn');
      if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target) && e.target !== btn) {
          menu.style.display = 'none';
        }
      }
    });

    _updateSongCard();
  }

  function _buildStageHTML() {
    var setName    = _esc(_lg.setlistName);
    var totalSongs = _lg.songs.length;

    return '<div class="lg-layout">' +

      /* Header */
      '<div class="lg-header">' +
        '<button class="lg-btn-exit" onclick="lgExit()">&#8592; EXIT</button>' +
        '<div class="lg-header-center">' +
          '<span class="lg-band-name">DEADCETERA</span>' +
          '<span class="lg-setlist-name">' + setName + '</span>' +
        '</div>' +
        '<div class="lg-header-right">' +
          '<span class="lg-song-counter" id="lgCounter">1 / ' + totalSongs + '</span>' +
          '<button class="lg-btn-fs" id="lgAudioBtn" onclick="lgToggleAudio()" title="Play audio" style="font-size:0.7em">&#x1F3A7;</button>' +
          '<button class="lg-btn-fs" id="lgFsBtn" onclick="lgToggleFullscreen()" title="Fullscreen">&#x26F6;</button>' +
          '<button class="lg-btn-fs" id="lgZenBtn" onclick="lgToggleZen()" title="Zen mode">&#x1F9D8;</button>' +
        '</div>' +
      '</div>' +

      /* Song info bar */
      '<div class="lg-song-bar" id="lgSongBar"><!-- filled by _updateSongCard --></div>' +

      /* Chart area */
      '<div class="lg-chart-region">' +
        '<div class="lg-chart-loading" id="lgChartLoading">Loading chart…</div>' +
        '<pre class="lg-chart-text" id="lgChartText"></pre>' +
        '<div class="lg-no-chart" id="lgNoChart" style="display:none">No chord chart for this song.</div>' +
      '</div>' +

      /* Controls */
      '<div class="lg-controls">' +
        '<button class="lg-ctrl-btn lg-btn-prev" id="lgPrevBtn" onclick="lgPrev()">&#9664; PREV</button>' +
        '<div class="lg-jump-wrap">' +
          '<button class="lg-ctrl-btn lg-btn-jump" id="lgJumpBtn" onclick="lgToggleJumpMenu()">JUMP &#9660;</button>' +
          '<div class="lg-jump-menu" id="lgJumpMenu" style="display:none"></div>' +
        '</div>' +
        '<button class="lg-ctrl-btn lg-btn-next" id="lgNextBtn" onclick="lgNext()">NEXT &#9654;</button>' +
      '</div>' +

      /* Up-next queue */
      '<div class="lg-queue" id="lgQueue"></div>' +

    '</div>';
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER: Song card update (hot path, cursor change)
  ───────────────────────────────────────────────────────────── */
  function _updateSongCard() {
    var song    = _lg.songs[_lg.cursor];
    var total   = _lg.songs.length;
    var counter = document.getElementById('lgCounter');
    var songBar = document.getElementById('lgSongBar');
    var queue   = document.getElementById('lgQueue');

    if (!song) return;

    // Counter
    if (counter) counter.textContent = (_lg.cursor + 1) + ' / ' + total;

    // Song info bar — title + badges
    if (songBar) {
      var keyStr = song.key ? ('<span class="lg-key-badge">' + _esc(song.key) + '</span>') : '';
      var bpmStr = song.bpm ? ('<span class="lg-bpm-badge">&#9834; ' + _esc(String(song.bpm)) + '</span>') : '';
      var statusStr = '';
      if (song.statusTag && STATUS_LABELS[song.statusTag]) {
        var col = STATUS_COLORS[song.statusTag] || '#888';
        statusStr = '<span class="lg-status-tag" style="background:' + col + '20;color:' + col + ';border-color:' + col + '40">' +
          STATUS_LABELS[song.statusTag] + '</span>';
      }
      songBar.innerHTML =
        '<span class="lg-song-title">' + _esc(song.title) + '</span>' +
        '<span class="lg-song-badges">' + keyStr + bpmStr + statusStr + '</span>';
    }

    // Load chart
    _loadChart(song.title);

    // Up-next queue
    if (queue) {
      var next1 = _lg.songs[_lg.cursor + 1];
      var next2 = _lg.songs[_lg.cursor + 2];
      if (next1) {
        var qParts = ['<span class="lg-queue-label">UP NEXT:</span>',
          '<span class="lg-queue-song">' + _esc(next1.title) + '</span>'];
        if (next2) {
          qParts.push('<span class="lg-queue-arrow">&#8594;</span>');
          qParts.push('<span class="lg-queue-song lg-queue-dim">' + _esc(next2.title) + '</span>');
        }
        queue.innerHTML = qParts.join(' ');
      } else {
        queue.innerHTML = '<span class="lg-queue-label">End of set</span>';
      }
    }
  }

  async function _loadChart(songTitle) {
    var loading = document.getElementById('lgChartLoading');
    var chartEl = document.getElementById('lgChartText');
    var noChart = document.getElementById('lgNoChart');
    if (!chartEl) return;

    if (loading) loading.style.display = 'block';
    chartEl.style.display = 'none';
    if (noChart) noChart.style.display = 'none';

    try {
      var cd = await loadBandDataFromDrive(songTitle, 'chart');
      if (loading) loading.style.display = 'none';
      if (cd && cd.text && cd.text.trim()) {
        chartEl.textContent = cd.text;
        chartEl.style.display = 'block';
      } else {
        if (noChart) noChart.style.display = 'block';
      }
    } catch(e) {
      if (loading) loading.style.display = 'none';
      if (noChart) noChart.style.display = 'block';
    }
  }

  function _buildReadinessHTML(readiness) {
    if (!readiness || Object.keys(readiness).length === 0) return '';
    var parts = ['<span class="lg-readiness-label">READINESS</span>'];
    MEMBER_KEYS.forEach(function (mk) {
      var score = readiness[mk];
      if (score == null) return;
      var dots = '';
      for (var i = 1; i <= 5; i++) {
        dots += '<span class="lg-dot' + (i <= score ? ' lg-dot-on' : '') + '"></span>';
      }
      parts.push(
        '<span class="lg-member-block">' +
          '<span class="lg-member-initial">' + (MEMBER_LABELS[mk] || mk[0].toUpperCase()) + '</span>' +
          dots +
        '</span>'
      );
    });
    return parts.join('');
  }

  function _buildLinksHTML(title, titleKey) {
    var enc        = encodeURIComponent(title);
    var preloaded  = _lg.preloaded[titleKey] || {};

    var archiveUrl  = preloaded.archive  || ('https://archive.org/search?query=' + enc + '+grateful+dead&and[]=mediatype%3Aetree');
    var relistenUrl = preloaded.relisten || ('https://relisten.net/grateful-dead?query=' + enc);
    var phishinUrl  = preloaded.phishin  || ('https://phish.in/search?q=' + enc);

    return '<a class="lg-link-btn" href="' + archiveUrl  + '" target="_blank" rel="noopener">&#128279; Archive</a>' +
           '<a class="lg-link-btn" href="' + relistenUrl + '" target="_blank" rel="noopener">&#128279; Relisten</a>' +
           '<a class="lg-link-btn" href="' + phishinUrl  + '" target="_blank" rel="noopener">&#128279; Phish.in</a>';
  }

  /* ─────────────────────────────────────────────────────────────
     JUMP MENU
  ───────────────────────────────────────────────────────────── */
  function _buildJumpMenu(menu) {
    var html = '';
    _lg.songs.forEach(function (s, idx) {
      var active = idx === _lg.cursor ? ' lg-jump-active' : '';
      html += '<div class="lg-jump-item' + active + '" onclick="lgJumpTo(' + idx + ')">' +
        '<span class="lg-jump-num">' + (idx + 1) + '</span>' +
        '<span class="lg-jump-title">' + _esc(s.title) + '</span>' +
        '</div>';
    });
    menu.innerHTML = html;
  }

  function _closeJumpMenu() {
    var menu = document.getElementById('lgJumpMenu');
    if (menu) menu.style.display = 'none';
  }

  /* ─────────────────────────────────────────────────────────────
     PRELOAD LINKS (background, non-blocking)
  ───────────────────────────────────────────────────────────── */
  function _preloadLinksBackground() {
    // Build URL strings only — no fetch() calls.
    // Links work offline-by-construction (constructed from song titles).
    var bandSlug = (window.getCurrentBandSlug && getCurrentBandSlug()) || 'deadcetera';
    // Worker proxy base for Archive searches
    var proxyBase = 'https://deadcetera-proxy.drewmerrill.workers.dev';

    var i = 0;
    function processNext() {
      if (i >= _lg.songs.length) return;
      var s        = _lg.songs[i];
      var enc      = encodeURIComponent(s.title);
      var titleKey = s.titleKey;

      _lg.preloaded[titleKey] = {
        archive:  proxyBase + '/archive-search?q=' + enc,
        relisten: 'https://relisten.net/grateful-dead?query=' + enc,
        phishin:  'https://phish.in/search?q=' + enc
      };

      i++;
      // yield to main thread between iterations
      setTimeout(processNext, 30);
    }
    setTimeout(processNext, 500); // start after first render
  }

  /* ─────────────────────────────────────────────────────────────
     FULLSCREEN ICON UPDATE
  ───────────────────────────────────────────────────────────── */
  function _updateFullscreenIcon() {
    var btn = document.getElementById('lgFsBtn');
    if (!btn) return;
    btn.innerHTML = _lg.fullscreen ? '&#x2715;' : '&#x26F6;';
  }

  /* ─────────────────────────────────────────────────────────────
     INPUT LISTENERS: keyboard + touch swipe
  ───────────────────────────────────────────────────────────── */
  function _attachInputListeners() {
    _detachInputListeners(); // safety: remove stale

    _lg._keyHandler = function (e) {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          lgNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          lgPrev();
          break;
        case 'Escape':
          lgExit();
          break;
        case 'f':
        case 'F':
          lgToggleFullscreen();
          break;
      }
    };

    _lg._touchStartHandler = function (e) {
      _lg.touchStartX = e.touches[0].clientX;
    };

    _lg._touchEndHandler = function (e) {
      if (_lg.touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - _lg.touchStartX;
      _lg.touchStartX = null;
      if (Math.abs(dx) < 50) return; // threshold
      if (dx < 0) lgNext();
      else         lgPrev();
    };

    document.addEventListener('keydown', _lg._keyHandler);
    var overlay = document.getElementById('lgOverlay');
    if (overlay) {
      overlay.addEventListener('touchstart', _lg._touchStartHandler, { passive: true });
      overlay.addEventListener('touchend',   _lg._touchEndHandler,   { passive: true });
    }
  }

  function _detachInputListeners() {
    if (_lg._keyHandler) {
      document.removeEventListener('keydown', _lg._keyHandler);
      _lg._keyHandler = null;
    }
    var overlay = document.getElementById('lgOverlay');
    if (overlay) {
      if (_lg._touchStartHandler) overlay.removeEventListener('touchstart', _lg._touchStartHandler);
      if (_lg._touchEndHandler)   overlay.removeEventListener('touchend',   _lg._touchEndHandler);
    }
    _lg._touchStartHandler = null;
    _lg._touchEndHandler   = null;
  }

  /* ─────────────────────────────────────────────────────────────
     CONTROL FLASH (end-of-set feedback)
  ───────────────────────────────────────────────────────────── */
  function _flashControl(btnId, msg) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('lg-btn-flash');
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove('lg-btn-flash');
    }, 1000);
  }

  /* ─────────────────────────────────────────────────────────────
     ERROR STATE
  ───────────────────────────────────────────────────────────── */
  function _renderError(msg) {
    var overlay = document.getElementById('lgOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lgOverlay';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.innerHTML =
      '<div class="lg-layout lg-error-layout">' +
        '<div class="lg-error-msg">&#9888; ' + _esc(msg) + '</div>' +
        '<button class="lg-btn-exit" onclick="lgExit()">&#8592; Back to Setlists</button>' +
      '</div>';
  }

  /* ─────────────────────────────────────────────────────────────
     UTILS
  ───────────────────────────────────────────────────────────── */
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ─────────────────────────────────────────────────────────────
     EXPORTS
  ───────────────────────────────────────────────────────────── */
  // ── Audio float player integration ─────────────────────────────────────
  var _lgAudioActive = false;

  function lgToggleAudio() {
    var E = window.GLPlayerEngine;
    var UI = window.GLPlayerUI;
    if (!E || !UI) { if (typeof showToast === 'function') showToast('Player not available'); return; }

    if (_lgAudioActive) {
      // Stop audio
      UI.closeAll();
      _lgAudioActive = false;
      _lgUpdateAudioBtn();
      return;
    }

    // Build song queue from current setlist
    var songs = _lg.songs.map(function(s) { return s.title || s; });
    if (!songs.length) { if (typeof showToast === 'function') showToast('No songs to play'); return; }

    E.loadQueue(songs, { name: _lg.setlistName || 'Live Set', context: 'Playing with charts' });
    UI.showFloat();
    E.play(_lg.cursor || 0);
    _lgAudioActive = true;
    _lgUpdateAudioBtn();

    // Sync: when live gig navigates, advance the audio player too
    E.on('songChange', _lgSyncFromEngine);
  }

  function _lgUpdateAudioBtn() {
    var btn = document.getElementById('lgAudioBtn');
    if (!btn) return;
    btn.style.background = _lgAudioActive ? 'rgba(99,102,241,0.3)' : '';
    btn.style.color = _lgAudioActive ? '#a5b4fc' : '';
    btn.title = _lgAudioActive ? 'Stop audio' : 'Play audio';
  }

  // When user navigates in Live Gig, sync the audio player
  var _origLgNext = lgNext;
  var _origLgPrev = lgPrev;

  lgNext = function() {
    _origLgNext();
    if (_lgAudioActive && window.GLPlayerEngine) {
      window.GLPlayerEngine.play(_lg.cursor);
    }
  };

  lgPrev = function() {
    _origLgPrev();
    if (_lgAudioActive && window.GLPlayerEngine) {
      window.GLPlayerEngine.play(_lg.cursor);
    }
  };

  // When engine advances (auto-advance), sync Live Gig cursor
  function _lgSyncFromEngine(d) {
    if (!_lgAudioActive) return;
    if (d.idx !== undefined && d.idx !== _lg.cursor && d.idx < _lg.songs.length) {
      _lg.cursor = d.idx;
      _updateSongCard();
    }
  }

  // Clean up audio on exit
  var _origLgExit = lgExit;
  lgExit = function() {
    if (_lgAudioActive && window.GLPlayerUI) {
      window.GLPlayerUI.closeAll();
      _lgAudioActive = false;
    }
    if (window.GLPlayerEngine) window.GLPlayerEngine.off('songChange', _lgSyncFromEngine);
    _origLgExit();
  };

  window.initLiveGig        = initLiveGig;
  window.lgNext             = lgNext;
  window.lgPrev             = lgPrev;
  window.lgJumpTo           = lgJumpTo;
  window.lgToggleFullscreen = lgToggleFullscreen;
  window.lgToggleAudio      = lgToggleAudio;
  window.lgExit             = lgExit;
  window.lgToggleJumpMenu   = lgToggleJumpMenu;

})();
