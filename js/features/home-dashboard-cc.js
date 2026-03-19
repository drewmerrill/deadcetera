// ============================================================================
// js/features/home-dashboard-cc.js
// Command Center extensions for home-dashboard.js
//
// Adds to the existing home dashboard:
//   1. Summary Strip (sticky pill row above the context banner)
//   2. Readiness Radar card
//   3. Pocket Snapshot card
//   4. Quick Actions card
//
// STRATEGY: Monkey-patches the existing renderHomeDashboard at load time.
// All additions are additive — nothing in home-dashboard.js is modified.
//
// DEPENDS ON:
//   renderHomeDashboard (home-dashboard.js — must load first)
//   readinessCache, readinessCacheLoaded    — app.js
//   allSongs                                — data.js
//   showPage()                              — navigation.js
//   showToast()                             — utils.js
//   window._lastPocketScore                 — pocket-meter.js (optional)
// ============================================================================

'use strict';

// ── Patch renderHomeDashboard to inject Command Center additions ──────────────

(function _patchHomeDashboard() {
  var _originalRender = window.renderHomeDashboard;
  if (typeof _originalRender !== "function") { console.warn("[cc] renderHomeDashboard not ready"); return; }

  window.renderHomeDashboard = async function renderHomeDashboard() {
    await _originalRender.apply(this, arguments);

    // After the original render, inject Command Center additions
    var container = document.getElementById('page-home');
    if (!container) return;

    var dashboard = container.querySelector('.home-dashboard');
    if (!dashboard) return;

    // Command Center layout (hd-command-center) already includes its own
    // health row, priority queue, and recent changes — skip all cc injections.
    // The old mission-board layout also handled its own strips.
    if (dashboard.classList.contains('hd-command-center') || dashboard.classList.contains('hd-mission-board')) {
      _ccInjectStyles(); // still inject styles for any leftover elements
      return;
    }

    // 1. Inject Summary Strip at the very top of .home-dashboard
    var strip = document.createElement('div');
    strip.id = 'cc-summary-strip';
    strip.innerHTML = _ccRenderSummaryStrip();
    dashboard.insertBefore(strip, dashboard.firstChild);

    // 2. Add new cards to card grid — Radar, Pocket, Quick Actions
    var cardGrid = dashboard.querySelector('.home-card-grid');
    if (cardGrid) {
      var radar = document.createElement('div');
      radar.innerHTML = _ccRenderReadinessRadar();
      Array.from(radar.children).forEach(function(el) { cardGrid.appendChild(el); });

      var pocket = document.createElement('div');
      pocket.innerHTML = _ccRenderPocketSnapshot();
      Array.from(pocket.children).forEach(function(el) { cardGrid.appendChild(el); });

      var qa = document.createElement('div');
      qa.innerHTML = _ccRenderQuickActions();
      Array.from(qa.children).forEach(function(el) { cardGrid.appendChild(el); });
    }

    // 3. Populate strip data after a short delay (wait for bundle data)
    setTimeout(_ccPopulateSummaryStrip, 500);

    _ccInjectStyles();
  };

  // Also patch refreshHomeDashboard so the strip re-injects on navigation back
  var _originalRefresh = window.refreshHomeDashboard;
  window.refreshHomeDashboard = async function refreshHomeDashboard() {
    await _originalRefresh.apply(this, arguments);
    var container = document.getElementById('page-home');
    if (!container) return;
    var dashboard = container.querySelector('.home-dashboard');
    if (!dashboard) return;
    // Skip cc injections for Command Center and mission-board layouts
    if (dashboard.classList.contains('hd-command-center') || dashboard.classList.contains('hd-mission-board')) {
      return;
    }
    if (!document.getElementById('cc-summary-strip')) {
      var strip = document.createElement('div');
      strip.id = 'cc-summary-strip';
      strip.innerHTML = _ccRenderSummaryStrip();
      dashboard.insertBefore(strip, dashboard.firstChild);
    }
    setTimeout(_ccPopulateSummaryStrip, 500);
  };
}());

// ── Summary Strip ─────────────────────────────────────────────────────────────

function _ccRenderSummaryStrip() {
  return [
    '<div class="cc-strip">',
    '  <div class="cc-strip-pill cc-strip-pill--skeleton" id="cc-pill-rehearsal" onclick="showPage(\'rehearsal\')" title="Next rehearsal">',
    '    📅 <span id="cc-rehearsal-text">—</span>',
    '  </div>',
    '  <div class="cc-strip-pill cc-strip-pill--skeleton" id="cc-pill-mix" onclick="showPage(\'practice\')" title="This week\'s mix">',
    '    🎵 <span id="cc-mix-text">—</span>',
    '  </div>',
    '  <div class="cc-strip-pill cc-strip-pill--skeleton" id="cc-pill-weak" onclick="ccOpenWeakSongs()" title="Songs needing work">',
    '    ⚠️ <span id="cc-weak-text">—</span>',
    '  </div>',
    '  <div class="cc-strip-pill cc-strip-pill--skeleton" id="cc-pill-harmony" onclick="ccOpenHarmonyTasks()" title="Harmony tasks">',
    '    🎤 <span id="cc-harmony-text">—</span>',
    '  </div>',
    '  <div class="cc-strip-pill cc-strip-pill--skeleton" id="cc-pill-pocket" onclick="showPage(\'pocketmeter\')" title="Pocket trend">',
    '    🎚️ <span id="cc-pocket-text">—</span>',
    '  </div>',
    '</div>',
  ].join('');
}

function _ccPopulateSummaryStrip() {
  // Weak songs from readinessCache
  try {
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var weakCount = 0;
    var ratedCount = 0;
    songs.forEach(function(song) {
      var scores = rc[song.title] || {};
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number'; });
      if (vals.length) {
        ratedCount++;
        var avg = vals.reduce(function(a,b){return a+b;},0) / vals.length;
        if (avg <= 2) weakCount++;
      }
    });
    var weakEl = document.getElementById('cc-weak-text');
    var statusText = weakCount ? weakCount + ' need work'
      : ratedCount >= 10 ? 'All rehearsed'
      : ratedCount > 0 ? ratedCount + ' rated'
      : 'No ratings yet';
    if (weakEl) weakEl.textContent = statusText;
    var weakPill = document.getElementById('cc-pill-weak');
    if (weakPill) {
      weakPill.classList.remove('cc-strip-pill--skeleton');
      if (weakCount > 0) weakPill.classList.add('cc-strip-pill--warn');
    }
  } catch(e) {}

  // Pocket trend — now populated by pocket-meter.js via window._lastPocketScore
  try {
    var score = window._lastPocketScore;
    var trend = window._lastPocketTrend;
    var pocketEl = document.getElementById('cc-pocket-text');
    if (pocketEl) {
      if (score !== null && score !== undefined) {
        var arrow = trend ? (trend.direction==='up'?'↑':trend.direction==='down'?'↓':'→') : '→';
        pocketEl.textContent = score + ' ' + arrow;
      } else {
        pocketEl.textContent = 'Groove: No data';
      }
    }
    document.getElementById('cc-pill-pocket')?.classList.remove('cc-strip-pill--skeleton');
  } catch(e) {}

  // Rehearsal — look for next rehearsal plan in Firebase
  _ccLoadNextRehearsal();

  // Mix pill — read most recent practice mix from Firebase
  _ccLoadActiveMix();

  // Harmony tasks stub
  var harmonyEl = document.getElementById('cc-harmony-text');
  if (harmonyEl) harmonyEl.textContent = '—';
  document.getElementById('cc-pill-harmony')?.classList.remove('cc-strip-pill--skeleton');
}

async function _ccLoadActiveMix() {
  var el   = document.getElementById('cc-mix-text');
  var pill = document.getElementById('cc-pill-mix');
  if (!el) return;
  try {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') {
      el.textContent = 'Mixes';
      pill?.classList.remove('cc-strip-pill--skeleton');
      return;
    }
    var snap = await firebaseDB.ref(bandPath('practice_mixes')).orderByChild('updatedAt').limitToLast(1).once('value');
    var val = snap.val();
    if (val) {
      var mix = Object.values(val)[0];
      var typeEmoji = {practice:'🎯', rehearsal:'🎸', gig:'🎤', weak:'⚠️'}[mix.type] || '🎵';
      el.textContent = typeEmoji + ' ' + (mix.title || 'Mix');
    } else {
      el.textContent = 'No mixes yet';
    }
  } catch(e) {
    el.textContent = 'Mixes';
  }
  pill?.classList.remove('cc-strip-pill--skeleton');
}

async function _ccLoadNextRehearsal() {
  var el = document.getElementById('cc-rehearsal-text');
  var pill = document.getElementById('cc-pill-rehearsal');
  if (!el) return;

  try {
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') {
      el.textContent = '—';
      pill?.classList.remove('cc-strip-pill--skeleton');
      return;
    }

    var today = new Date().toISOString().slice(0,10);
    var candidates = [];

    // Source 1: rehearsals (primary path used by rehearsal.js and home dashboard card)
    try {
      var snap0 = await firebaseDB.ref(bandPath('rehearsals')).once('value');
      var rehearsals = snap0.val() || {};
      Object.values(rehearsals).forEach(function(r) {
        if (r.date && r.date >= today) {
          candidates.push({ date: r.date, rsvps: r.rsvps || {}, source: 'rehearsal' });
        }
      });
    } catch(e) {}

    // Source 2: rehearsal_plans (legacy path)
    try {
      var snap1 = await firebaseDB.ref(bandPath('rehearsal_plans')).once('value');
      var plans = snap1.val() || {};
      Object.values(plans).forEach(function(p) {
        if (p.date && p.date >= today) {
          candidates.push({ date: p.date, rsvps: p.rsvps || {}, source: 'plan' });
        }
      });
    } catch(e) {}

    // Source 2: calendar_events where type === 'rehearsal' (created from Calendar page)
    try {
      var snap2 = await firebaseDB.ref(bandPath('calendar_events')).once('value');
      var events = snap2.val() || {};
      Object.values(events).forEach(function(ev) {
        var evDate = (ev.date || ev.startDate || '').slice(0,10);
        if ((ev.type === 'rehearsal' || ev.eventType === 'rehearsal') && evDate >= today) {
          candidates.push({ date: evDate, rsvps: ev.rsvps || {}, source: 'calendar' });
        }
      });
    } catch(e) {}

    // Sort by date, pick soonest
    candidates.sort(function(a,b) { return a.date.localeCompare(b.date); });

    if (candidates.length) {
      var next = candidates[0];
      var diff = (typeof glDaysAway === 'function') ? glDaysAway(next.date) : Math.round((new Date(next.date + 'T12:00:00') - Date.now()) / 86400000);
      var dateLabel = diff === 0 ? 'Tonight' : diff === 1 ? 'Tomorrow' : ((typeof glFormatDate === 'function') ? glFormatDate(next.date, true) : next.date.slice(5));

      // Count confirmed RSVPs
      var confirmedCount = Object.values(next.rsvps).filter(function(r) {
        return r === 'yes' || r === true || (r && r.status === 'yes');
      }).length;

      // Show "Tentative" prefix when nobody has confirmed yet
      el.textContent = confirmedCount === 0 ? 'Tentative ' + dateLabel : dateLabel;
      if (diff <= 1) pill?.classList.add('cc-strip-pill--urgent');
    } else {
      el.textContent = 'None scheduled';
    }
  } catch(e) {
    el.textContent = '—';
  }
  pill?.classList.remove('cc-strip-pill--skeleton');
}

// ── Readiness Radar Card ───────────────────────────────────────────────────────

function _ccRenderReadinessRadar() {
  var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
  var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};

  // Score every song
  var scored = songs.map(function(song) {
    var scores = rc[song.title] || {};
    var vals = Object.values(scores).filter(function(v) { return typeof v === 'number'; });
    var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : null;
    return { title: song.title, avg: avg };
  }).filter(function(s) { return s.avg !== null; })
    .sort(function(a,b) { return a.avg - b.avg; })
    .slice(0, 6);

  if (!scored.length) {
    return [
      '<div class="home-card cc-card--radar">',
      '  <div class="home-card__header"><span class="home-card__icon">📊</span><span class="home-card__label">Readiness Radar</span></div>',
      '  <div class="home-card__sub" style="margin-top:8px;color:var(--text-dim,#64748b)">Rate songs to see readiness scores here</div>',
      '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'songs\')" style="margin-top:12px">Go to Songs →</button>',
      '</div>',
    ].join('');
  }

  var rows = scored.map(function(s) {
    var pct = Math.round((s.avg / 5) * 100);
    var label = s.avg >= 4.5 ? 'tight' : s.avg >= 3.5 ? 'good' : s.avg >= 2.5 ? 'drifting' : s.avg >= 1.5 ? 'needs work' : 'underlearned';
    var barColor = s.avg >= 4 ? '#10b981' : s.avg >= 3 ? '#f59e0b' : '#ef4444';
    var titleEsc = _ccEsc(s.title);
    var titleOnclick = s.title.replace(/'/g,"\\'");
    return [
      '<div class="cc-radar-row" onclick="selectSong(\'' + titleOnclick + '\');showPage(\'songdetail\')" title="Open ' + titleEsc + '">',
      '  <div class="cc-radar-name">' + titleEsc + '</div>',
      '  <div class="cc-radar-bar-wrap">',
      '    <div class="cc-radar-bar" style="width:' + pct + '%;background:' + barColor + '"></div>',
      '  </div>',
      '  <div class="cc-radar-label" style="color:' + barColor + '">' + label + '</div>',
      '</div>',
    ].join('');
  }).join('');

  return [
    '<div class="home-card cc-card--radar">',
    '  <div class="home-card__header"><span class="home-card__icon">📊</span><span class="home-card__label">Readiness Radar</span></div>',
    '  <div class="cc-radar-list">' + rows + '</div>',
    '  <button class="home-card__cta home-card__cta--ghost" onclick="showPage(\'songs\')" style="margin-top:10px;font-size:0.78em">See all songs →</button>',
    '</div>',
  ].join('');
}

// ── Pocket Snapshot Card ──────────────────────────────────────────────────────

function _ccRenderPocketSnapshot() {
  var score = (window._lastPocketScore !== null && window._lastPocketScore !== undefined)
    ? window._lastPocketScore : null;
  var trend = window._lastPocketTrend || null;

  var scoreHTML, trendHTML;
  if (score !== null) {
    var trendArrow = trend ? (trend.direction==='up' ? '↑' : trend.direction==='down' ? '↓' : '→') : '→';
    var trendColor = trend ? (trend.direction==='up' ? '#10b981' : trend.direction==='down' ? '#ef4444' : '#94a3b8') : '#94a3b8';
    var scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    scoreHTML = '<div class="cc-pocket-score" style="color:' + scoreColor + '">' + score +
                '<span class="cc-pocket-trend" style="color:' + trendColor + '">' + trendArrow + '</span></div>';
    trendHTML = '<div class="cc-pocket-label">Last groove score (0–100)</div>';
  } else {
    scoreHTML = '<div class="cc-pocket-score cc-pocket-score--empty">—</div>';
    trendHTML = '<div class="cc-pocket-label">Open Pocket Meter during rehearsal to record</div>';
  }

  return [
    '<div class="home-card cc-card--pocket">',
    '  <div class="home-card__header"><span class="home-card__icon">🎚️</span><span class="home-card__label">Pocket Snapshot</span></div>',
    '  ' + scoreHTML,
    '  ' + trendHTML,
    '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'pocketmeter\')" style="margin-top:12px">',
    '    Open Pocket Meter →',
    '  </button>',
    '</div>',
  ].join('');
}

// ── Quick Actions Card ────────────────────────────────────────────────────────

function _ccRenderQuickActions() {
  var actions = [
    { icon: '➕', label: 'Add Song',       onclick: 'showAddCustomSongModal()' },
    { icon: '🔗', label: 'Add Reference',  onclick: 'ccActionAddRef()' },
    { icon: '🎛️', label: 'Build Mix',      onclick: 'showPage(\'practice\')' },
    { icon: '🎤', label: 'Harmony Lab',    onclick: 'ccOpenHarmonyLab()' },
    { icon: '🎸', label: 'Rehearsal Mode', onclick: 'showPage(\'rehearsal\')' },
    { icon: '📊', label: 'Radar',          onclick: 'showPage(\'songs\')' },
  ];

  var btns = actions.map(function(a) {
    return [
      '<button class="cc-qa-btn" onclick="' + a.onclick + '">',
      '  <span class="cc-qa-icon">' + a.icon + '</span>',
      '  <span class="cc-qa-label">' + a.label + '</span>',
      '</button>',
    ].join('');
  }).join('');

  return [
    '<div class="home-card cc-card--qa">',
    '  <div class="home-card__header"><span class="home-card__icon">⚡</span><span class="home-card__label">Quick Actions</span></div>',
    '  <div class="cc-qa-grid">' + btns + '</div>',
    '</div>',
  ].join('');
}

// ── Quick Action handlers ─────────────────────────────────────────────────────

window.ccActionAddRef = function ccActionAddRef() {
  if (!selectedSong) {
    if (typeof showToast === 'function') showToast('Select a song first');
    showPage('songs');
    return;
  }
  if (typeof launchVersionHub === 'function') launchVersionHub();
};

window.ccOpenHarmonyLab = function ccOpenHarmonyLab() {
  if (!selectedSong) {
    if (typeof showToast === 'function') showToast('Select a song to open Harmony Lab');
    showPage('songs');
    return;
  }
  showPage('songdetail');
  setTimeout(function() {
    if (typeof switchLens === 'function') switchLens('sing');
  }, 100);
};

window.ccOpenWeakSongs = function ccOpenWeakSongs() {
  showPage('songs');
};

window.ccOpenHarmonyTasks = function ccOpenHarmonyTasks() {
  showPage('songs');
  if (typeof showToast === 'function') showToast('Harmony tasks coming in Phase 2');
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function _ccEsc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Styles ────────────────────────────────────────────────────────────────────

function _ccInjectStyles() {
  if (document.getElementById('cc-styles')) return;
  var s = document.createElement('style');
  s.id = 'cc-styles';
  s.textContent = `
/* ── Command Center Summary Strip ──────────────────────────────── */
.cc-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
  margin-bottom: 4px;
}
.cc-strip-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.78em;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: var(--text-muted, #94a3b8);
  transition: all 0.15s;
  white-space: nowrap;
}
.cc-strip-pill:hover { background: rgba(255,255,255,0.1); color: var(--text, #f1f5f9); }
.cc-strip-pill--skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: ccStripPulse 1.4s infinite;
  pointer-events: none;
}
.cc-strip-pill--warn { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
.cc-strip-pill--urgent { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #fbbf24; }
@keyframes ccStripPulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Readiness Radar Card ────────────────────────────────────────── */
.cc-card--radar .cc-radar-list { margin-top: 8px; }
.cc-radar-row {
  display: grid;
  grid-template-columns: 1fr 80px 80px;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: background 0.12s;
  border-radius: 4px;
}
.cc-radar-row:hover { background: rgba(255,255,255,0.04); }
.cc-radar-row:last-child { border-bottom: none; }
.cc-radar-name { font-size: 0.83em; font-weight: 600; color: var(--text, #f1f5f9); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-radar-bar-wrap { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
.cc-radar-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.cc-radar-label { font-size: 0.72em; font-weight: 700; text-align: right; white-space: nowrap; }

/* ── Pocket Snapshot Card ────────────────────────────────────────── */
.cc-pocket-score {
  font-size: 3em;
  font-weight: 900;
  color: var(--text, #f1f5f9);
  line-height: 1;
  margin: 10px 0 4px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cc-pocket-score--empty { color: var(--text-dim, #64748b); }
.cc-pocket-trend { font-size: 0.5em; font-weight: 800; }
.cc-pocket-label { font-size: 0.8em; color: var(--text-muted, #94a3b8); }

/* ── Quick Actions Card ──────────────────────────────────────────── */
.cc-qa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
}
.cc-qa-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text, #f1f5f9);
}
.cc-qa-btn:hover {
  background: rgba(102,126,234,0.12);
  border-color: rgba(102,126,234,0.3);
  transform: translateY(-1px);
}
.cc-qa-btn:active { transform: translateY(0); }
.cc-qa-icon { font-size: 1.4em; }
.cc-qa-label { font-size: 0.7em; font-weight: 700; text-align: center; color: var(--text-muted, #94a3b8); white-space: nowrap; }
  `;
  document.head.appendChild(s);
}

console.log('✅ home-dashboard-cc.js loaded');
