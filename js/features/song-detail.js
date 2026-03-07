// ============================================================================
// js/features/song-detail.js
// GrooveLinx Song Detail — 5-Lens Tab Scaffold
//
// Renders the song detail page with five named lenses:
//   Band · Listen · Learn · Sing · Inspire
//
// STRATEGY: Wraps existing step-card content (step2, stepVersionHub, etc.)
// inside lens panels. Does NOT modify existing DOM IDs or functions.
// The existing step-cards stay in page-songs but are hidden; this page
// renders its own parallel version of the content via showBandResources().
//
// DEPENDENCIES:
//   selectedSong                      — app.js global
//   showBandResources(songTitle)       — app.js
//   renderBestShotVsNorthStar()        — app.js
//   launchVersionHub()                 — version-hub.js
//   readinessCache, readinessCacheLoaded — app.js
//   getCurrentMemberReadinessKey()     — app.js
//   BAND_MEMBERS_ORDERED               — app.js
//   showPage()                         — navigation.js
//   showToast()                        — utils.js
//
// EXPOSES to window:
//   renderSongDetail(songTitle)
//   switchLens(lens)
//   glSongDetailBack()
// ============================================================================

'use strict';

// ── Module state ─────────────────────────────────────────────────────────────
var _sdCurrentLens   = 'band';
var _sdCurrentSong   = null;
var _sdInitialized   = false;

var SD_LENSES = [
  { id: 'band',    icon: '🎸', label: 'Band'    },
  { id: 'listen',  icon: '📻', label: 'Listen'  },
  { id: 'learn',   icon: '📖', label: 'Learn'   },
  { id: 'sing',    icon: '🎤', label: 'Sing'    },
  { id: 'inspire', icon: '✨', label: 'Inspire' },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main entry point. Called by navigation.js pageRenderers.songdetail.
 * @param {string} [songTitle]  Override — if omitted uses selectedSong.
 */
window.renderSongDetail = function renderSongDetail(songTitle) {
  var title = songTitle || (selectedSong && (selectedSong.title || selectedSong));
  if (!title) {
    // No song selected — bounce back
    if (typeof showPage === 'function') showPage('songs');
    return;
  }

  _sdCurrentSong = title;

  var container = document.getElementById('page-songdetail');
  if (!container) return;

  container.innerHTML = _sdShellHTML(title);
  _sdInitialized = true;

  // Activate default lens
  switchLens(_sdCurrentLens);

  // Load Band lens content via existing showBandResources
  _sdPopulateBandLens(title);

  // Entrance animation
  requestAnimationFrame(function() {
    container.classList.add('sd-entered');
  });
};

/**
 * Switch the active lens tab.
 * @param {string} lens  One of: band | listen | learn | sing | inspire
 */
window.switchLens = function switchLens(lens) {
  if (!SD_LENSES.find(function(l) { return l.id === lens; })) return;
  _sdCurrentLens = lens;

  // Update tab buttons
  document.querySelectorAll('.sd-tab-btn').forEach(function(btn) {
    var active = btn.dataset.lens === lens;
    btn.classList.toggle('sd-tab-btn--active', active);
  });

  // Show/hide panels
  document.querySelectorAll('.sd-lens-panel').forEach(function(panel) {
    var active = panel.dataset.lens === lens;
    panel.classList.toggle('sd-lens-panel--active', active);
    panel.style.display = active ? 'block' : 'none';
  });

  // Lazy-populate on first visit
  if (lens === 'listen')  _sdPopulateListenLens(_sdCurrentSong);
  if (lens === 'learn')   _sdPopulateLearnLens(_sdCurrentSong);
  if (lens === 'sing')    _sdPopulateSingLens(_sdCurrentSong);
  if (lens === 'inspire') _sdPopulateInspireLens(_sdCurrentSong);
};

/** Navigate back to songs list */
window.glSongDetailBack = function glSongDetailBack() {
  if (typeof showPage === 'function') showPage('songs');
};

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _sdShellHTML(title) {
  var song = (typeof allSongs !== 'undefined')
    ? allSongs.find(function(s) { return s.title === title; })
    : null;
  var band  = song ? (song.band || '') : '';
  var key   = song ? (song.key  || '') : '';
  var bpm   = song ? (song.bpm  || '') : '';

  var metaPills = '';
  if (key)  metaPills += '<span class="sd-meta-pill">🔑 ' + _sdEsc(key) + '</span>';
  if (bpm)  metaPills += '<span class="sd-meta-pill">🥁 ' + _sdEsc(String(bpm)) + ' BPM</span>';
  if (band) metaPills += '<span class="sd-meta-pill sd-band-pill ' + band.toLowerCase() + '">' + _sdEsc(band) + '</span>';

  var tabsHTML = SD_LENSES.map(function(lens) {
    var active = lens.id === _sdCurrentLens ? ' sd-tab-btn--active' : '';
    return '<button class="sd-tab-btn' + active + '" data-lens="' + lens.id + '" ' +
           'onclick="switchLens(\'' + lens.id + '\')">' +
           '<span class="sd-tab-icon">' + lens.icon + '</span>' +
           '<span class="sd-tab-label">' + lens.label + '</span>' +
           '</button>';
  }).join('');

  var panelsHTML = SD_LENSES.map(function(lens) {
    var active = lens.id === _sdCurrentLens;
    return '<div class="sd-lens-panel" data-lens="' + lens.id + '" ' +
           'style="display:' + (active ? 'block' : 'none') + '">' +
           _sdPanelSkeleton(lens.id) +
           '</div>';
  }).join('');

  return [
    '<div class="song-detail-page">',

    // ── Header ──
    '<div class="sd-header">',
    '  <div class="sd-header-top">',
    '    <button class="sd-back-btn" onclick="glSongDetailBack()">',
    '      <span>←</span> <span class="sd-back-label">Songs</span>',
    '    </button>',
    '    <div class="sd-header-meta">' + metaPills + '</div>',
    '  </div>',
    '  <h1 class="sd-title">' + _sdEsc(title) + '</h1>',
    '  <div id="sd-readiness-strip" class="sd-readiness-strip"></div>',
    '</div>',

    // ── Tab bar ──
    '<div class="sd-tab-bar">' + tabsHTML + '</div>',

    // ── Lens panels ──
    '<div class="sd-panels">' + panelsHTML + '</div>',

    '</div>',
  ].join('');
}

function _sdPanelSkeleton(lensId) {
  return '<div class="sd-panel-skeleton" id="sd-panel-' + lensId + '">' +
         '<div class="sd-skeleton-pulse" style="height:24px;width:40%;margin-bottom:12px;border-radius:6px"></div>' +
         '<div class="sd-skeleton-pulse" style="height:16px;width:70%;margin-bottom:8px;border-radius:4px"></div>' +
         '<div class="sd-skeleton-pulse" style="height:16px;width:55%;border-radius:4px"></div>' +
         '</div>';
}

// ── Band Lens ─────────────────────────────────────────────────────────────────

function _sdPopulateBandLens(title) {
  var panel = document.getElementById('sd-panel-band');
  if (!panel) return;

  // Copy Song DNA (step2) content into Band lens
  // We clone the relevant sub-sections from step2 and render them here.
  // The original step2 stays hidden in page-songs.
  panel.innerHTML = [
    '<div class="sd-section">',

    // Song DNA metadata row
    '<div class="sd-section-title">Song DNA</div>',
    '<div class="sd-dna-grid">',
    '  <div class="sd-dna-item">',
    '    <span class="sd-dna-label">🎤 Lead</span>',
    '    <select id="sd-leadSingerSelect" onchange="updateLeadSinger(this.value)" class="app-select sd-select">',
    '      <option value="">Select...</option>',
    '      <option value="drew">Drew</option>',
    '      <option value="chris">Chris</option>',
    '      <option value="brian">Brian</option>',
    '      <option value="pierce">Pierce</option>',
    '      <option value="drew,chris">Drew &amp; Chris</option>',
    '    </select>',
    '  </div>',
    '  <div class="sd-dna-item">',
    '    <span class="sd-dna-label">🎯 Status</span>',
    '    <select id="sd-songStatusSelect" onchange="updateSongStatus(this.value)" class="app-select sd-select">',
    '      <option value="">— Not on Radar —</option>',
    '      <option value="prospect">👀 Prospect</option>',
    '      <option value="wip">🔧 Work in Progress</option>',
    '      <option value="gig_ready">✅ Gig Ready</option>',
    '    </select>',
    '  </div>',
    '  <div class="sd-dna-item">',
    '    <span class="sd-dna-label">🔑 Key</span>',
    '    <select id="sd-songKeySelect" onchange="updateSongKey(this.value)" class="app-select sd-select" style="width:80px">',
    '      <option value="">—</option>',
    ['A','Am','Bb','B','Bm','C','C#','D','Dm','E','Em','F','F#','G','Gm','Ab'].map(function(k){
      return '<option>' + k + '</option>';
    }).join(''),
    '    </select>',
    '  </div>',
    '  <div class="sd-dna-item">',
    '    <span class="sd-dna-label">🥁 BPM</span>',
    '    <input type="number" id="sd-songBpmInput" min="40" max="240" placeholder="120" onchange="updateSongBpm(this.value)" class="app-input sd-bpm-input">',
    '  </div>',
    '</div>',

    // Readiness
    '<div id="sd-readinessContainer" class="sd-readiness-section"></div>',

    // Section status + rehearsal notes (loaded via showBandResources)
    '<div id="sd-bandResourcesMount"></div>',
    '</div>',
  ].join('');

  // Load existing Band content (readiness, north star meta, crib notes, rehearsal notes)
  // We fire showBandResources which populates the original step2 DOM in page-songs.
  // Then we copy the useful bits across.
  if (typeof showBandResources === 'function') {
    showBandResources(title);
  }
  if (typeof renderBestShotVsNorthStar === 'function') {
    renderBestShotVsNorthStar(title);
  }

  // Mirror key/bpm/lead/status from the original selects after a short delay
  setTimeout(function() {
    _sdSyncSelects();
    _sdBuildReadinessStrip(title);
  }, 400);
}

function _sdSyncSelects() {
  var pairs = [
    ['leadSingerSelect',  'sd-leadSingerSelect'],
    ['songStatusSelect',  'sd-songStatusSelect'],
    ['songKeySelect',     'sd-songKeySelect'],
    ['songBpmInput',      'sd-songBpmInput'],
  ];
  pairs.forEach(function(pair) {
    var src = document.getElementById(pair[0]);
    var dst = document.getElementById(pair[1]);
    if (src && dst) dst.value = src.value;
  });
}

function _sdBuildReadinessStrip(title) {
  var strip = document.getElementById('sd-readiness-strip');
  if (!strip) return;
  var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
  var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : ['drew','chris','brian','pierce','jay'];
  var songScores = rc[title] || {};

  var pills = members.map(function(m) {
    var score = songScores[m];
    var color = score ? (typeof readinessColor === 'function' ? readinessColor(score) : '#667eea') : 'rgba(255,255,255,0.12)';
    var label = score ? score : '—';
    return '<span class="sd-readiness-pill" style="background:' + color + '" title="' + m + '">' +
           m.charAt(0).toUpperCase() + ':' + label +
           '</span>';
  }).join('');

  strip.innerHTML = '<div class="sd-readiness-pills">' + pills + '</div>';
}

// ── Listen Lens ───────────────────────────────────────────────────────────────

var _sdListenPopulated = false;
function _sdPopulateListenLens(title) {
  if (_sdListenPopulated) return;
  _sdListenPopulated = true;

  var panel = document.getElementById('sd-panel-listen');
  if (!panel) return;

  panel.innerHTML = [
    '<div class="sd-section">',
    '<div class="sd-section-title">Find a Version</div>',
    '<p class="sd-section-desc">Search Archive.org, Relisten, Phish.in, YouTube and more for the best recordings of this song.</p>',
    '<button class="btn btn-primary sd-launch-btn" onclick="launchVersionHub()" style="width:100%;padding:14px;font-size:0.95em;background:linear-gradient(135deg,#667eea,#764ba2)">',
    '  🔍 Open Version Hub',
    '</button>',
    '</div>',

    '<div class="sd-section" style="margin-top:16px">',
    '<div class="sd-section-title">North Star <span class="sd-title-badge">Reference</span></div>',
    '<div id="sd-northStarMount" class="sd-mount-zone"></div>',
    '</div>',

    '<div class="sd-section" style="margin-top:16px">',
    '<div class="sd-section-title">Best Shot <span class="sd-title-badge sd-title-badge--gold">Our Recording</span></div>',
    '<div id="sd-bestShotMount" class="sd-mount-zone"></div>',
    '</div>',
  ].join('');

  // Copy rendered content from original step-cards (populated by showBandResources earlier)
  setTimeout(function() {
    _sdMirrorContent('northStarContainer',  'sd-northStarMount');
    _sdMirrorContent('bestShotContainer',   'sd-bestShotMount');
  }, 600);
}

// ── Learn Lens ────────────────────────────────────────────────────────────────

var _sdLearnPopulated = false;
function _sdPopulateLearnLens(title) {
  if (_sdLearnPopulated) return;
  _sdLearnPopulated = true;

  var panel = document.getElementById('sd-panel-learn');
  if (!panel) return;

  panel.innerHTML = [
    '<div class="sd-section">',
    '<div class="sd-section-title">Practice Tracks</div>',
    '<div id="sd-practiceTracksMount" class="sd-mount-zone"></div>',
    '</div>',

    '<div class="sd-section" style="margin-top:16px">',
    '<div class="sd-section-title">Personal Tabs &amp; Charts</div>',
    '<div id="sd-personalTabsMount" class="sd-mount-zone"></div>',
    '</div>',

    '<div class="sd-section" style="margin-top:16px">',
    '<div class="sd-section-title">Cover Versions to Study</div>',
    '<div id="sd-coverMeMount" class="sd-mount-zone"></div>',
    '</div>',
  ].join('');

  setTimeout(function() {
    _sdMirrorContent('practiceTracksContainer',  'sd-practiceTracksMount');
    _sdMirrorContent('personalTabsContainer',    'sd-personalTabsMount');
    _sdMirrorContent('coverMeContainer',         'sd-coverMeMount');
  }, 600);
}

// ── Sing Lens ─────────────────────────────────────────────────────────────────

var _sdSingPopulated = false;
function _sdPopulateSingLens(title) {
  if (_sdSingPopulated) return;
  _sdSingPopulated = true;

  var panel = document.getElementById('sd-panel-sing');
  if (!panel) return;

  panel.innerHTML = '<div id="sd-harmony-lab-mount"></div>';

  if (typeof renderHarmonyLab === 'function') {
    renderHarmonyLab(title, 'sd-harmony-lab-mount');
  } else {
    panel.innerHTML = [
      '<div class="sd-section sd-coming-soon">',
      '  <div class="sd-cs-icon">🎤</div>',
      '  <div class="sd-cs-title">Harmony Lab</div>',
      '  <div class="sd-cs-desc">Loading harmony workspace…</div>',
      '</div>',
    ].join('');
  }
}

// ── Inspire Lens ──────────────────────────────────────────────────────────────

var _sdInspirePopulated = false;
function _sdPopulateInspireLens(title) {
  if (_sdInspirePopulated) return;
  _sdInspirePopulated = true;

  var panel = document.getElementById('sd-panel-inspire');
  if (!panel) return;

  panel.innerHTML = [
    '<div class="sd-section sd-coming-soon">',
    '  <div class="sd-cs-icon">✨</div>',
    '  <div class="sd-cs-title">Inspire</div>',
    '  <div class="sd-cs-desc">Mood clips, covers, and creative references. Coming soon.</div>',
    '  <div class="sd-cs-hint">This lens will surface covers, alternate interpretations, and inspirational performances to spark your creativity.</div>',
    '</div>',
  ].join('');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _sdEsc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Attempt to mirror innerHTML from an existing container into a mount zone.
 * Falls back gracefully if the source container doesn't exist or is empty.
 */
function _sdMirrorContent(sourceId, mountId) {
  var src   = document.getElementById(sourceId);
  var mount = document.getElementById(mountId);
  if (!src || !mount) return;
  var html = src.innerHTML.trim();
  if (!html || html === '' || html.includes('sd-skeleton-pulse')) return;
  mount.innerHTML = html;
}

// ── Navigation registration ───────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
  pageRenderers['songdetail'] = function() {
    // Reset per-song state on each navigation
    _sdListenPopulated  = false;
    _sdLearnPopulated   = false;
    _sdSingPopulated    = false;
    _sdInspirePopulated = false;
    _sdCurrentLens      = 'band';
    window.renderSongDetail();
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

(function _sdInjectStyles() {
  if (document.getElementById('sd-styles')) return;
  var s = document.createElement('style');
  s.id = 'sd-styles';
  s.textContent = `
/* ── Song Detail Page ──────────────────────────────────────── */
.song-detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 0 80px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
#page-songdetail.sd-entered .song-detail-page {
  opacity: 1;
  transform: none;
}

/* Header */
.sd-header {
  padding: 16px 16px 0;
  background: var(--bg-card, #1e293b);
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(12px);
}
.sd-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sd-back-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, #94a3b8);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.82em;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
}
.sd-back-btn:hover { background: rgba(255,255,255,0.06); color: var(--text, #f1f5f9); }
.sd-header-meta { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.sd-meta-pill {
  font-size: 0.75em;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 12px;
  background: rgba(255,255,255,0.07);
  color: var(--text-muted, #94a3b8);
  border: 1px solid rgba(255,255,255,0.08);
}
.sd-title {
  font-size: 1.55em;
  font-weight: 800;
  color: var(--text, #f1f5f9);
  margin: 0 0 10px;
  line-height: 1.2;
}
.sd-readiness-strip { margin-bottom: 10px; }
.sd-readiness-pills { display: flex; gap: 5px; flex-wrap: wrap; }
.sd-readiness-pill {
  font-size: 0.72em;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  color: white;
}

/* Tab bar */
.sd-tab-bar {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg-card, #1e293b);
  border-bottom: 2px solid var(--border, rgba(255,255,255,0.08));
  padding: 0 8px;
  scrollbar-width: none;
  position: sticky;
  top: 0;
  z-index: 49;
}
.sd-tab-bar::-webkit-scrollbar { display: none; }
.sd-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 14px 8px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
}
.sd-tab-btn:hover { color: var(--text, #f1f5f9); background: rgba(255,255,255,0.03); }
.sd-tab-btn--active {
  color: var(--accent, #667eea);
  border-bottom-color: var(--accent, #667eea);
}
.sd-tab-icon { font-size: 1.2em; }
.sd-tab-label { font-size: 0.72em; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }

/* Panels */
.sd-panels { padding: 16px; }
.sd-lens-panel { min-height: 200px; }

/* Sections */
.sd-section {
  background: var(--bg-card, #1e293b);
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}
.sd-section-title {
  font-size: 0.88em;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #94a3b8);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sd-title-badge {
  font-size: 0.75em;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 8px;
  background: rgba(102,126,234,0.15);
  color: #818cf8;
  text-transform: none;
  letter-spacing: 0;
}
.sd-title-badge--gold { background: rgba(251,191,36,0.15); color: #fbbf24; }
.sd-section-desc { font-size: 0.88em; color: var(--text-muted, #94a3b8); margin-bottom: 14px; line-height: 1.5; }
.sd-launch-btn { margin-top: 4px; }
.sd-mount-zone { min-height: 40px; }

/* DNA grid */
.sd-dna-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.sd-dna-item { display: flex; align-items: center; gap: 6px; }
.sd-dna-label { font-size: 0.82em; font-weight: 700; color: var(--text-muted, #94a3b8); white-space: nowrap; }
.sd-select { font-size: 0.82em !important; padding: 5px 8px !important; }
.sd-bpm-input { width: 65px !important; padding: 5px 8px !important; font-size: 0.82em !important; }

/* Readiness section */
.sd-readiness-section { margin-top: 8px; }

/* Coming soon */
.sd-coming-soon {
  text-align: center;
  padding: 40px 20px;
}
.sd-cs-icon { font-size: 2.5em; margin-bottom: 12px; }
.sd-cs-title { font-size: 1.15em; font-weight: 800; color: var(--text, #f1f5f9); margin-bottom: 8px; }
.sd-cs-desc { font-size: 0.9em; color: var(--text-muted, #94a3b8); margin-bottom: 12px; }
.sd-cs-hint { font-size: 0.82em; color: var(--text-dim, #64748b); line-height: 1.6; }

/* Skeleton */
.sd-panel-skeleton { padding: 8px 0; }
.sd-skeleton-pulse {
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 75%);
  background-size: 200% 100%;
  animation: sdSkeletonPulse 1.4s infinite;
}
@keyframes sdSkeletonPulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
  `;
  document.head.appendChild(s);
}());

console.log('✅ song-detail.js loaded');
