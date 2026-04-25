/**
 * js/features/stage-plot.js — Stage Plot Builder v1
 *
 * Grid-based stage layout with band member positions, gear icons,
 * channel list, and monitor mixes. Persists to Firebase.
 *
 * Phase 1: grid layout + data model + persistence (shipped)
 * Phase 2: export/print + rider notes + contact + duplicate/reset (this build)
 * Phase 3: drag-and-drop canvas + richer rider builder (future)
 *
 * DEPENDS ON: firebase-service.js, data.js (bandMembers), navigation.js
 * EXPOSES: renderStagePlotPage
 */

'use strict';

// ── Data Model ──────────────────────────────────────────────────────────────
// Each stage plot:
// {
//   id: string,
//   name: string (e.g. "Club Setup", "Festival"),
//   stageWidth: number (ft),
//   stageDepth: number (ft),
//   elements: [{ type, label, x, y, icon, rotation }],
//   channels: [{ num, label, source }],
//   monitors: [{ id, label, mix }],
//   createdAt: string,
//   updatedAt: string
// }

var _spPlots = [];
var _spCurrentIdx = -1;
var _spDirty = false;

// Industry-standard mic library — picked from FOH/MON pro recommendations.
// Each mic carries: model name, type (dynamic/condenser/ribbon), pattern,
// phantom power requirement, typical use, and stand type.
var SP_MIC_LIBRARY = [
  { model: 'Shure SM58',     type: 'dynamic',   pattern: 'cardioid',    phantom: false, use: 'Lead vocal',         stand: 'Boom' },
  { model: 'Shure Beta 58A', type: 'dynamic',   pattern: 'supercardioid', phantom: false, use: 'Lead vocal (hot)',  stand: 'Boom' },
  { model: 'Shure SM57',     type: 'dynamic',   pattern: 'cardioid',    phantom: false, use: 'Snare / gtr cab',    stand: 'Short boom' },
  { model: 'Shure Beta 57A', type: 'dynamic',   pattern: 'supercardioid', phantom: false, use: 'Snare / hi-hat',  stand: 'Short boom' },
  { model: 'Shure Beta 52A', type: 'dynamic',   pattern: 'supercardioid', phantom: false, use: 'Kick drum',        stand: 'Short boom' },
  { model: 'Shure Beta 91A', type: 'condenser', pattern: 'half-cardioid', phantom: true, use: 'Kick (inside)',     stand: 'None (placed)' },
  { model: 'Shure SM81',     type: 'condenser', pattern: 'cardioid',    phantom: true,  use: 'Hi-hat / overhead',   stand: 'Boom' },
  { model: 'Shure KSM8',     type: 'dynamic',   pattern: 'cardioid',    phantom: false, use: 'Vocal (premium)',     stand: 'Boom' },
  { model: 'Shure KSM9',     type: 'condenser', pattern: 'switchable',  phantom: true,  use: 'Vocal (condenser)',   stand: 'Boom' },
  { model: 'Sennheiser e835', type: 'dynamic',  pattern: 'cardioid',    phantom: false, use: 'Vocal',               stand: 'Boom' },
  { model: 'Sennheiser e906', type: 'dynamic',  pattern: 'supercardioid', phantom: false, use: 'Guitar cab',       stand: 'Hangs (no stand)' },
  { model: 'Sennheiser e609', type: 'dynamic',  pattern: 'supercardioid', phantom: false, use: 'Guitar cab',       stand: 'Hangs (no stand)' },
  { model: 'Sennheiser MD421', type: 'dynamic', pattern: 'cardioid',    phantom: false, use: 'Toms / gtr cab',      stand: 'Boom / clip' },
  { model: 'Sennheiser MD441', type: 'dynamic', pattern: 'supercardioid', phantom: false, use: 'Vocal / instrument', stand: 'Boom' },
  { model: 'AKG C414',       type: 'condenser', pattern: 'switchable',  phantom: true,  use: 'Overhead / vocal',    stand: 'Boom' },
  { model: 'AKG D112',       type: 'dynamic',   pattern: 'cardioid',    phantom: false, use: 'Kick drum',           stand: 'Short boom' },
  { model: 'Audio-Technica AT4050', type: 'condenser', pattern: 'switchable', phantom: true, use: 'Vocal / overhead', stand: 'Boom' },
  { model: 'Royer R-121',    type: 'ribbon',    pattern: 'figure-8',    phantom: false, use: 'Guitar cab (warm)',   stand: 'Boom' },
  { model: 'DI (passive)',   type: 'di',        pattern: 'n/a',         phantom: false, use: 'Bass / keys / acoustic', stand: 'On-floor' },
  { model: 'DI (active)',    type: 'di',        pattern: 'n/a',         phantom: true,  use: 'Bass / keys / acoustic', stand: 'On-floor' },
];

// Element library
var SP_ELEMENTS = {
  musicians: [
    { type: 'musician', icon: '🎤', label: 'Vocal' },
    { type: 'musician', icon: '🎸', label: 'Guitar' },
    { type: 'musician', icon: '🎸', label: 'Bass' },
    { type: 'musician', icon: '🎹', label: 'Keys' },
    { type: 'musician', icon: '🥁', label: 'Drums' },
    { type: 'musician', icon: '🪘', label: 'Percussion' },
  ],
  gear: [
    { type: 'gear', icon: '📻', label: 'Guitar Amp' },
    { type: 'gear', icon: '📻', label: 'Bass Amp' },
    { type: 'gear', icon: '🎹', label: 'Keyboard Rig' },
    { type: 'gear', icon: '🥁', label: 'Drum Kit' },
    { type: 'gear', icon: '🎛️', label: 'Pedalboard' },
    { type: 'gear', icon: '💻', label: 'Laptop' },
    { type: 'gear', icon: '📡', label: 'IEM Rack' },
  ],
  audio: [
    { type: 'audio', icon: '🎙️', label: 'Vocal Mic',     mic: 'Shure SM58' },
    { type: 'audio', icon: '🎙️', label: 'Inst Mic',      mic: 'Shure SM57' },
    { type: 'audio', icon: '🥁', label: 'Kick Mic',       mic: 'Shure Beta 52A' },
    { type: 'audio', icon: '🥁', label: 'Snare Mic',      mic: 'Shure SM57' },
    { type: 'audio', icon: '🎙️', label: 'Overhead Mic',  mic: 'AKG C414' },
    { type: 'audio', icon: '🎚', label: 'Cab Mic',        mic: 'Sennheiser e906' },
    { type: 'audio', icon: '📦', label: 'DI Box',         mic: 'DI (passive)' },
    { type: 'audio', icon: '🔊', label: 'Floor Monitor' },
    { type: 'audio', icon: '🔈', label: 'Side Fill' },
    { type: 'audio', icon: '🎧', label: 'IEM Pack' },
  ],
  stage: [
    { type: 'stage', icon: '⬜', label: 'Riser' },
    { type: 'stage', icon: '⬜', label: 'Drum Riser' },
    { type: 'stage', icon: '⚡', label: 'Power Drop' },
  ]
};

// Lookup a mic spec from the library by model name.
function _spLookupMic(modelName) {
  if (!modelName) return null;
  for (var i = 0; i < SP_MIC_LIBRARY.length; i++) {
    if (SP_MIC_LIBRARY[i].model === modelName) return SP_MIC_LIBRARY[i];
  }
  return null;
}

// Deterministic color for a member name — used for the initials avatar so
// FOH/MON can match face → name → role at a glance, BandHelper-style.
// We don't have actual photos, so this is the substitute.
function _spInitialsColor(name) {
  var s = String(name || '').toLowerCase();
  var hash = 0;
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  var hue = Math.abs(hash) % 360;
  return 'hsl(' + hue + ', 55%, 45%)';
}

function _spInitials(name) {
  var s = String(name || '').trim();
  if (!s) return '?';
  var parts = s.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Venue presets
var SP_PRESETS = {
  'Club Stage':    { w: 20, d: 12 },
  'Small Stage':   { w: 16, d: 10 },
  'Festival Stage': { w: 40, d: 24 },
  'Large Stage':   { w: 32, d: 20 },
};

// Move mode state
var _spMoveIdx = -1;
var _spShowLabels = true; // labels toggle
var _spShowDirections = true; // stage direction markers
var _spShareMode = false; // share/send mode: compact, no editor chrome

// Size classes: controls visual weight of each element type on the grid
// 'sm' = small (gear, monitors, DI), 'md' = medium (musicians, amps), 'lg' = large (drums, risers)
var SP_SIZE_CLASS = {
  'Vocal': 'sm', 'Guitar': 'md', 'Bass': 'md', 'Keys': 'md', 'Drums': 'lg', 'Percussion': 'md',
  'Guitar Amp': 'sm', 'Bass Amp': 'sm', 'Keyboard Rig': 'md', 'Drum Kit': 'lg', 'Pedalboard': 'sm', 'Laptop': 'sm', 'IEM Rack': 'sm',
  'Vocal Mic': 'sm', 'Inst Mic': 'sm', 'DI Box': 'sm', 'Floor Monitor': 'sm', 'Side Fill': 'md', 'IEM Pack': 'sm',
  'Riser': 'lg', 'Drum Riser': 'lg', 'Power Drop': 'sm'
};

// Compact labels for share mode
var SP_COMPACT = {
  'Vocal': 'Vox', 'Guitar': 'Gtr', 'Bass': 'Bass', 'Keys': 'Keys', 'Drums': 'Drums', 'Percussion': 'Perc',
  'Guitar Amp': 'Gtr Amp', 'Bass Amp': 'Bass Amp', 'Keyboard Rig': 'Keys Rig', 'Drum Kit': 'Kit', 'Pedalboard': 'PB', 'Laptop': 'PC', 'IEM Rack': 'IEM',
  'Vocal Mic': 'Vox Mic', 'Inst Mic': 'Mic', 'DI Box': 'DI', 'Floor Monitor': 'Mon', 'Side Fill': 'SF', 'IEM Pack': 'IEM',
  'Riser': 'Riser', 'Drum Riser': 'Riser', 'Power Drop': 'Pwr'
};

// ── Station Model (Phase B) ──────────────────────────────────────────────────

var SP_ROLE_ICONS = {
  'Guitar': '🎸', 'Bass': '🎸', 'Keys': '🎹', 'Keyboard': '🎹',
  'Drums': '🥁', 'Percussion': '🪘', 'Vocal': '🎤', 'Vocals': '🎤'
};

var SP_COMPONENT_ICONS = {
  instrument: { guitar: '🎸', bass: '🎸', keys: '🎹', drums: '🥁', percussion: '🪘', vocal: '🎤' },
  pedalboard: '🎛️',
  mic: '🎙️',
  monitor: { wedge: '🔊', iem: '🎧', sidefill: '🔈' }
};

function _spMakeDefaultStation(name, role, x, y) {
  var kind = (role || '').toLowerCase();
  if (kind === 'keyboard') kind = 'keys';
  return {
    id: 'station_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'station',
    musicianName: name || '',
    role: role || '',
    x: x || 0,
    y: y || 2,
    sizeClass: kind === 'drums' ? 'lg' : 'md',
    orientation: 'front',
    components: {
      instrument: { enabled: true, kind: kind || 'guitar' },
      pedalboard: { enabled: kind === 'guitar' || kind === 'bass', position: 'downstage' },
      mic: { enabled: kind !== 'drums', position: 'front_center' },
      monitor: { enabled: true, kind: 'wedge', position: 'front_left' }
    }
  };
}

function _spGetComponentOffsets(station) {
  // Returns relative positions for child components within a station cell
  // Offsets are percentages from station anchor
  var o = station.orientation || 'front';
  return {
    instrument: { dx: 0, dy: 0 },  // center
    mic:        { dx: 0, dy: -28 }, // above/front
    pedalboard: { dx: 22, dy: 18 }, // below-right
    monitor:    { dx: -22, dy: 22 } // below-left
  };
}

function _spRenderStation(station, idx, share) {
  var sc = station.sizeClass || 'md';
  var cellSpan = sc === 'lg' ? 2 : 1;
  var minH = share ? (sc === 'lg' ? '52px' : '38px') : (sc === 'lg' ? '60px' : '44px');
  var bgColor = 'rgba(99,102,241,0.08)';
  var borderColor = 'rgba(99,102,241,0.2)';
  var pad = share ? '3px 2px' : '4px 3px';
  var roleIcon = SP_ROLE_ICONS[station.role] || '🎵';
  var comps = station.components || {};
  if (!comps.mic) comps.mic = { enabled: false };
  if (!comps.pedalboard) comps.pedalboard = { enabled: false };
  if (!comps.monitor) comps.monitor = { enabled: false, kind: 'wedge' };
  var shortName = share ? (station.musicianName || '').split(' ')[0] : (station.musicianName || '');
  var roleLabel = share ? (SP_COMPACT[station.role] || station.role || '') : (station.role || '');

  // Build sub-icons for enabled components
  var subIcons = '';
  if (comps.mic && comps.mic.enabled) subIcons += '<span style="font-size:0.5em">🎙️</span>';
  if (comps.pedalboard && comps.pedalboard.enabled) subIcons += '<span style="font-size:0.5em">🎛️</span>';
  if (comps.monitor && comps.monitor.enabled) {
    var monIcon = comps.monitor.kind === 'iem' ? '🎧' : comps.monitor.kind === 'sidefill' ? '🔈' : '🔊';
    subIcons += '<span style="font-size:0.5em">' + monIcon + '</span>';
  }

  var html = '<div class="sp-cell" style="background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:6px;padding:' + pad + ';text-align:center;min-height:' + minH + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:' + (share ? 'default' : 'pointer') + ';position:relative;overflow:hidden'
    + (cellSpan > 1 ? ';grid-column:span ' + cellSpan : '') + '"'
    + (share ? '' : ' onclick="_spClickStation(' + idx + ')"') + '>';

  // Initials avatar — colored circle with member's initials. Substitute for
  // a real photo (members don't have photo fields). Helps FOH/MON match
  // face → name when looking at the stage during line check.
  var initials = _spInitials(station.musicianName);
  var avatarColor = _spInitialsColor(station.musicianName);
  var avatarSize = share ? '14px' : '18px';
  html += '<div style="display:flex;align-items:center;gap:3px;line-height:1">'
    + '<div style="width:' + avatarSize + ';height:' + avatarSize + ';border-radius:50%;background:' + avatarColor + ';color:#fff;font-size:' + (share ? '0.42em' : '0.5em') + ';font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + _spEsc(initials) + '</div>'
    + '<span style="font-size:' + (share ? '0.7em' : '0.75em') + ';line-height:1">' + roleIcon + '</span>'
    + '</div>';
  html += '<span style="font-size:' + (share ? '0.44em' : '0.48em') + ';font-weight:700;color:var(--text);line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:' + (share ? '58px' : '66px') + '">' + _spEsc(shortName) + '</span>';
  if (subIcons) html += '<div style="display:flex;gap:1px;margin-top:1px">' + subIcons + '</div>';

  if (!share) {
    html += '<button class="sp-del" onclick="event.stopPropagation();_spRemoveStation(' + idx + ')" style="position:absolute;top:0;right:1px;background:none;border:none;color:#64748b;cursor:pointer;font-size:0.5em;padding:1px;opacity:0;transition:opacity 0.15s">✕</button>';
  }
  html += '</div>';
  return html;
}

function _spRenderStationLayout(plot) {
  var share = _spShareMode;
  var stations = plot.stations || [];
  var cols = Math.min(10, Math.max(6, stations.length + 3));
  var rows = 5;
  var gap = share ? '3px' : '4px';
  var cellMin = share ? '22px' : '28px';

  var html = '<div class="' + (share ? 'sp-share' : '') + '" style="position:relative;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.1);border-radius:10px;padding:' + (share ? '10px 8px 6px' : '14px 10px 8px') + '">';
  html += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--bg,#1e293b);padding:0 8px;font-size:0.58em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">STAGE' + (share ? '' : ' — ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\'') + '</div>';

  // Build station placement map
  var cellMap = {}; // 'x,y' → station index
  stations.forEach(function(st, i) {
    cellMap[st.x + ',' + st.y] = i;
    if (st.sizeClass === 'lg') cellMap[(st.x + 1) + ',' + st.y] = -1; // occupied by span
  });

  html += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:' + gap + '">';
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var key = c + ',' + r;
      var stIdx = cellMap[key];
      if (stIdx !== undefined && stIdx >= 0) {
        html += _spRenderStation(stations[stIdx], stIdx, share);
      } else if (stIdx === -1) {
        // Cell occupied by span — skip
        continue;
      } else {
        // Empty cell
        if (share) {
          html += '<div style="min-height:' + cellMin + '"></div>';
        } else {
          var emptyLabel = _spMoveIdx >= 0 ? '↗' : '';
          html += '<div style="border:1px dashed rgba(255,255,255,0.04);border-radius:4px;min-height:' + cellMin + ';display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="_spPlaceStationAtCell(' + c + ',' + r + ')"><span style="color:rgba(255,255,255,0.1);font-size:0.5em">' + emptyLabel + '</span></div>';
        }
      }
    }
  }
  html += '</div>';

  // Audience
  html += '<div style="text-align:center;margin-top:6px;font-size:0.52em;font-weight:700;color:rgba(255,255,255,0.12);letter-spacing:0.15em;text-transform:uppercase">&#x25BC; AUDIENCE &#x25BC;</div>';
  html += '</div>';
  return html;
}

// ── Station Editor ──────────────────────────────────────────────────────────

function _spClickStation(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.stations || !plot.stations[idx]) return;
  var st = plot.stations[idx];
  // Guard: ensure components exist (may be missing from old Firebase data)
  if (!st.components) {
    st.components = {
      instrument: { enabled: true, kind: (st.role || 'guitar').toLowerCase() },
      pedalboard: { enabled: false, position: 'downstage' },
      mic: { enabled: false, position: 'front_center' },
      monitor: { enabled: true, kind: 'wedge', position: 'front_left' }
    };
  }
  if (!st.components.pedalboard) st.components.pedalboard = { enabled: false, position: 'downstage' };
  if (!st.components.mic) st.components.mic = { enabled: false, position: 'front_center' };
  if (!st.components.monitor) st.components.monitor = { enabled: true, kind: 'wedge', position: 'front_left' };

  var action = prompt(
    st.musicianName + ' (' + st.role + ')\n\n1 = Edit name/role\n2 = Move\n3 = Toggle pedalboard\n4 = Toggle mic\n5 = Toggle monitor\n6 = Change monitor type\n7 = Change size\n8 = Cancel',
    '1'
  );
  if (action === '1') {
    var name = prompt('Musician name:', st.musicianName);
    if (name !== null) st.musicianName = name;
    var role = prompt('Role (Guitar, Bass, Keys, Drums, Vocals, Percussion):', st.role);
    if (role !== null) st.role = role;
    _spDirty = true; _spRender();
  } else if (action === '2') {
    _spMoveIdx = idx;
    if (typeof showToast === 'function') showToast('Tap an empty cell to move ' + st.musicianName);
    _spRender();
  } else if (action === '3') {
    st.components.pedalboard.enabled = !st.components.pedalboard.enabled;
    _spDirty = true; _spRender();
  } else if (action === '4') {
    st.components.mic.enabled = !st.components.mic.enabled;
    _spDirty = true; _spRender();
  } else if (action === '5') {
    st.components.monitor.enabled = !st.components.monitor.enabled;
    _spDirty = true; _spRender();
  } else if (action === '6') {
    var kind = prompt('Monitor type (wedge, iem, sidefill):', st.components.monitor.kind || 'wedge');
    if (kind !== null) { st.components.monitor.kind = kind.toLowerCase(); _spDirty = true; _spRender(); }
  } else if (action === '7') {
    st.sizeClass = st.sizeClass === 'lg' ? 'md' : 'lg';
    _spDirty = true; _spRender();
  }
}

function _spAddStation() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.stations) plot.stations = [];
  var name = prompt('Musician name:', '');
  if (!name) return;
  var role = prompt('Role (Guitar, Bass, Keys, Drums, Vocals, Percussion):', 'Guitar');
  if (!role) return;
  // Find next open cell (account for lg stations spanning 2 cols)
  var occupied = {};
  plot.stations.forEach(function(s) {
    occupied[s.x + ',' + s.y] = true;
    if (s.sizeClass === 'lg') occupied[(s.x + 1) + ',' + s.y] = true;
  });
  var x = 1, y = 2;
  for (var c = 0; c < 10; c++) {
    if (!occupied[c + ',2']) { x = c; break; }
  }
  var station = _spMakeDefaultStation(name, role, x, y);
  plot.stations.push(station);
  _spDirty = true;
  _spRender();
}

function _spRemoveStation(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.stations) return;
  plot.stations.splice(idx, 1);
  _spDirty = true;
  _spRender();
}

function _spPlaceStationAtCell(x, y) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  // Move mode for stations
  if (_spMoveIdx >= 0 && plot.stations && plot.stations[_spMoveIdx]) {
    plot.stations[_spMoveIdx].x = x;
    plot.stations[_spMoveIdx].y = y;
    _spMoveIdx = -1;
    _spDirty = true;
    _spRender();
    return;
  }
  // For legacy item placement
  _spPlaceAtCell(x, y);
}

function _spConvertToStations() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!confirm('Convert this layout to station mode? Existing items will be preserved as legacy.')) return;
  plot.layoutMode = 'stations';
  if (!plot.stations) {
    plot.stations = [];
    // Auto-create stations from musician elements
    (plot.elements || []).forEach(function(el) {
      if (el.type === 'musician') {
        var parts = el.label.split(' – ');
        var name = parts[0] || el.label;
        var role = parts[1] || 'Guitar';
        plot.stations.push(_spMakeDefaultStation(name, role, el.x, el.y));
      }
    });
  }
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('Converted to station layout');
}

// ── Page Renderer ────────────────────────────────────────────────────────────

function renderStagePlotPage(el) {
  if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'stageplot');
  el.innerHTML = '<div class="page-header"><h1>🎭 Stage Plot</h1><p>Build stage layouts, channel lists, and monitor mixes</p></div>'
    + '<div id="spContainer" style="max-width:800px;margin:0 auto"><div style="color:var(--text-dim);text-align:center;padding:20px">Loading...</div></div>';
  _spLoadPlots();
}

async function _spLoadPlots() {
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var snap = await firebaseDB.ref(bandPath('stage_plots')).once('value');
      var val = snap.val();
      _spPlots = val ? Object.values(val) : [];
    }
  } catch(e) { _spPlots = []; }

  if (!_spPlots.length) {
    // Auto-create default from band members
    _spCreateDefault();
  }

  // If we arrived via a share link, jump to that plot if it exists.
  if (window._spPendingShareId) {
    var idx = _spPlots.findIndex(function(p) { return p.id === window._spPendingShareId; });
    if (idx >= 0) _spCurrentIdx = idx;
    else _spCurrentIdx = 0;
    delete window._spPendingShareId;
  } else {
    _spCurrentIdx = 0;
  }
  _spRender();
}

function _spCreateDefault() {
  var stations = [];
  var elements = [];
  var col = 1;
  if (typeof bandMembers !== 'undefined') {
    Object.entries(bandMembers).forEach(function(e) {
      var key = e[0], m = e[1];
      var role = m.role || 'Guitar';
      var row = role === 'Drums' ? 1 : 2;
      stations.push(_spMakeDefaultStation(m.name, role, col, row));
      // Also create legacy elements for backward compat
      var icon = role === 'Drums' ? '🥁' : role === 'Keyboard' ? '🎹' : role === 'Bass' ? '🎸' : '🎸';
      elements.push({ type: 'musician', icon: icon, label: m.name + ' – ' + role, x: col, y: row });
      col++;
    });
  }
  _spPlots = [{
    id: 'default',
    name: 'Default Setup',
    layoutMode: 'stations',
    stageWidth: 24,
    stageDepth: 16,
    stations: stations,
    elements: elements,
    channels: [],
    monitors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }];
}

function _spRender() {
  var container = document.getElementById('spContainer');
  if (!container) return;
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) { container.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px">No stage plots</div>'; return; }

  // Inject hover CSS for delete buttons + dropdown fixes (only once)
  if (!document.getElementById('spHoverCSS')) {
    var style = document.createElement('style');
    style.id = 'spHoverCSS';
    style.textContent = '.sp-cell .sp-del{opacity:0;transition:opacity 0.15s}.sp-cell:hover .sp-del{opacity:1}'
      + '.sp-share .sp-cell .sp-del{display:none}'
      + '.sp-select{background:#1e293b;border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;padding:6px 10px;border-radius:6px;font-size:0.85em}'
      + '.sp-select option{background:#1e293b;color:#e2e8f0}'
      + '.sp-select:focus{outline:1px solid #667eea;border-color:#667eea}'
      + '.sp-plot-title{cursor:pointer;border-bottom:1px dashed rgba(255,255,255,0.2);padding-bottom:1px}'
      + '.sp-plot-title:hover{color:#a5b4fc;border-bottom-color:#a5b4fc}';
    document.head.appendChild(style);
  }

  var share = _spShareMode;
  var html = '';

  if (!share) {
    // ── Edit Mode Controls ──
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
    html += '<select id="spPlotSelect" onchange="_spSwitchPlot(this.value)" class="sp-select">';
    _spPlots.forEach(function(p, i) {
      html += '<option value="' + i + '"' + (i === _spCurrentIdx ? ' selected' : '') + '>' + _spEsc(p.name) + '</option>';
    });
    html += '</select>';
    html += '<span class="sp-plot-title" onclick="_spRenamePlot()" style="font-size:0.82em;font-weight:700;color:var(--text)" title="Click to rename">' + _spEsc(plot.name) + ' ✎</span>';
    html += '<button onclick="_spAddPlot()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">+ New</button>';
    html += '<button onclick="_spSaveAs()" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);color:#a5b4fc;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.72em;font-weight:600">Save As</button>';
    html += '<button onclick="_spDuplicatePlot()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.72em;font-weight:600">Dup</button>';
    html += '<select onchange="_spApplyPreset(this.value)" class="sp-select" style="font-size:0.72em;padding:4px 6px"><option value="">Presets...</option>' + Object.keys(SP_PRESETS).map(function(k) { return '<option value="' + k + '">' + k + '</option>'; }).join('') + '</select>';
    html += '<div style="margin-left:auto;display:flex;gap:6px">';
    html += '<button onclick="_spToggleShareMode()" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">&#x1F4E4; Share View</button>';
    html += '<button onclick="_spSave()" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">Save</button>';
    html += '</div></div>';

    // Display toggles
    html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
    html += '<label for="spToggleLabels" style="display:flex;align-items:center;gap:4px;font-size:0.68em;color:var(--text-dim);cursor:pointer"><input type="checkbox" id="spToggleLabels" name="spLabels" ' + (_spShowLabels ? 'checked' : '') + ' onchange="_spToggleLabels(this.checked)" style="accent-color:#667eea"> Labels</label>';
    html += '<label for="spToggleDirections" style="display:flex;align-items:center;gap:4px;font-size:0.68em;color:var(--text-dim);cursor:pointer"><input type="checkbox" id="spToggleDirections" name="spDirections" ' + (_spShowDirections ? 'checked' : '') + ' onchange="_spToggleDirections(this.checked)" style="accent-color:#667eea"> Stage directions</label>';
    html += '</div>';
  } else {
    // ── Share Mode Header ──
    var bandName = localStorage.getItem('deadcetera_band_name') || 'GrooveLinx';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<div><div style="font-size:1.1em;font-weight:800;color:var(--text)">' + _spEsc(bandName) + '</div>'
      + '<div style="font-size:0.72em;color:var(--text-dim)">' + _spEsc(plot.name) + ' — ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\'</div></div>';
    html += '<div style="display:flex;gap:6px">';
    html += '<button onclick="_spExportView()" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);color:#fbbf24;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">Print / PDF</button>';
    html += '<button onclick="_spCopyShareLink()" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700" title="Copy a link the FOH engineer can bookmark — always shows the current version">📋 Copy link</button>';
    html += '<button onclick="_spToggleShareMode()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text-dim);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">← Edit</button>';
    html += '</div></div>';
  }

  // Stage canvas — branch by layout mode
  var isStationMode = plot.layoutMode === 'stations' && plot.stations && plot.stations.length > 0;
  html += isStationMode ? _spRenderStationLayout(plot) : _spRenderStage(plot);

  if (!share) {
    if (isStationMode) {
      // Station mode controls
      html += '<div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap">';
      html += '<button onclick="_spAddStation()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">+ Add Station</button>';
      html += '<button onclick="_spConvertToLegacy()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.68em">Switch to Item Mode</button>';
      html += '</div>';
    } else {
      // Legacy element palette
      html += '<div style="margin-top:14px">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Add to Stage</span>';
      html += '<button onclick="_spConvertToStations()" style="margin-left:auto;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.65em;font-weight:600">⬆ Station Mode</button>';
      html += '</div>';
      html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
      Object.keys(SP_ELEMENTS).forEach(function(cat) {
        SP_ELEMENTS[cat].forEach(function(el) {
          var micArg = el.mic ? ',\'' + _spEsc(el.mic) + '\'' : '';
          var hint = el.mic ? ' style="font-size:0.55em;color:var(--text-dim);margin-left:2px"' : '';
          var micBadge = el.mic ? '<span style="font-size:0.55em;color:#94a3b8;margin-left:3px">' + _spEsc(el.mic.split(' ').pop()) + '</span>' : '';
          html += '<button onclick="_spAddElement(\'' + el.type + '\',\'' + _spEsc(el.icon) + '\',\'' + _spEsc(el.label) + '\'' + micArg + ')" title="' + _spEsc(el.mic || el.label) + '" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 6px;border-radius:5px;cursor:pointer;font-size:0.68em;display:flex;align-items:center;gap:3px"><span style="font-size:0.9em">' + el.icon + '</span><span>' + el.label + '</span>' + micBadge + '</button>';
        });
      });
      html += '</div></div>';
    }

    // Channel list
    html += _spRenderChannelList(plot);

    // Monitor mixes
    html += _spRenderMonitorMixes(plot);

    // Tech rider notes
    html += '<div style="margin-top:20px">';
    html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Tech Rider Notes</div>';
    html += '<textarea id="spRiderNotes" onchange="_spUpdateRiderNotes(this.value)" placeholder="Power requirements, IEM notes, backline needs, FOH instructions..." style="width:100%;min-height:80px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:8px 10px;border-radius:6px;font-size:0.82em;font-family:inherit;resize:vertical;box-sizing:border-box">' + _spEsc(plot.riderNotes || '') + '</textarea>';
    html += '</div>';

    // Contact block
    html += '<div style="margin-top:16px">';
    html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Band Contact</div>';
    html += '<input id="spContact" onchange="_spUpdateContact(this.value)" value="' + _spEsc(plot.contact || '') + '" placeholder="Name, phone, email for sound check coordination" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:6px 10px;border-radius:6px;font-size:0.82em;box-sizing:border-box">';
    html += '</div>';

    // ── Linked Gig + Setlist (auto-attaches plot to gig record) ──
    html += '<div style="margin-top:16px">';
    html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Linked Gig &amp; Setlist</div>';
    html += '<div id="spGigLinkArea" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + '<span style="font-size:0.78em;color:var(--text-muted)">Linked gig: <b id="spLinkedGigLabel">' + (plot.linkedGigId ? _spEsc(plot.linkedGigVenue || plot.linkedGigId) : '<span style="color:var(--text-dim);font-weight:400">none</span>') + '</b></span>'
      + '<button onclick="_spLinkToGig()" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);color:#a5b4fc;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.7em">Pick gig</button>'
      + (plot.linkedGigId ? '<button onclick="_spUnlinkGig()" style="background:none;border:1px solid rgba(255,255,255,0.08);color:var(--text-dim);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.7em">Unlink</button>' : '')
      + '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">'
      + '<span style="font-size:0.78em;color:var(--text-muted)">Set variant: <b>' + _spEsc(plot.setVariantLabel || '(applies to whole gig)') + '</b></span>'
      + '<button onclick="_spEditSetVariant()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.7em">Tag set / song range</button>'
      + '</div>';
    html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:4px">Use a tag like "Set 1" or "Acoustic opener" if this plot only applies to part of the gig.</div>';
    html += '</div>';

    // ── Show-day checklist mode ──
    var hasChecklist = plot.checklist && plot.checklist.length;
    html += '<div style="margin-top:16px;padding:10px 12px;border-radius:8px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    html += '<span style="font-size:0.72em;font-weight:700;color:#86efac;letter-spacing:0.05em;text-transform:uppercase">🎤 Show-day checklist</span>';
    html += '<button onclick="_spChecklistAdd()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add item</button>';
    html += '</div>';
    if (!hasChecklist) {
      html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px">Standard load-in / soundcheck / show items the band ticks off on the day. Add what your gigs need; checked state resets each gig.</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px"><button onclick="_spChecklistSeedDefaults()" style="background:rgba(34,197,94,0.08);border:1px dashed rgba(34,197,94,0.3);color:#86efac;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.7em">Use default checklist</button></div>';
    } else {
      plot.checklist.forEach(function(item, i) {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
          + '<input type="checkbox"' + (item.done ? ' checked' : '') + ' onchange="_spChecklistToggle(' + i + ',this.checked)" style="accent-color:#22c55e">'
          + '<input value="' + _spEsc(item.label || '') + '" onchange="_spChecklistEdit(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:var(--text);padding:3px 6px;border-radius:4px;font-size:0.78em' + (item.done ? ';text-decoration:line-through;opacity:0.5' : '') + '">'
          + '<button onclick="_spChecklistRemove(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em">✕</button>'
          + '</div>';
      });
      html += '<div style="display:flex;gap:6px;margin-top:6px">'
        + '<button onclick="_spChecklistResetAll()" style="background:none;border:1px solid rgba(255,255,255,0.08);color:var(--text-dim);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.65em">Uncheck all (new gig)</button>'
        + '</div>';
    }
    html += '</div>';

    // ── Branding (custom logo + accent color for exports) ──
    var brandColor = plot.brandColor || '#667eea';
    html += '<div style="margin-top:16px">';
    html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Export Branding</div>';
    html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:0.78em;color:var(--text-muted)">'
      + '<span>Accent:</span>'
      + '<input type="color" value="' + brandColor + '" onchange="_spUpdateBrandColor(this.value)" style="width:36px;height:28px;border:1px solid rgba(255,255,255,0.1);border-radius:4px;cursor:pointer;background:none">'
      + '</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:0.78em;color:var(--text-muted);cursor:pointer">'
      + '<span>Logo:</span>'
      + (plot.brandLogo ? '<img src="' + plot.brandLogo + '" style="height:28px;max-width:80px;border-radius:4px;background:#fff;padding:2px"> <button onclick="_spClearBrandLogo()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.85em" title="Remove logo">✕</button>' : '<input type="file" accept="image/*" onchange="_spUploadBrandLogo(this)" style="font-size:0.75em;color:var(--text-dim)">')
      + '</label>';
    html += '</div>';
    html += '<div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Used on PDF / share-link exports.</div>';
    html += '</div>';
  } else {
    // Share mode: read-only channel list + monitors + rider
    html += _spRenderShareDetails(plot);
  }

  container.innerHTML = html;
}

function _spRenderStage(plot) {
  var share = _spShareMode;
  // Wider grid: up to 10 cols for denser layout; 5 rows (back, mid-back, center, mid-front, front)
  var cols = Math.min(10, Math.max(6, plot.elements.length + 2));
  var rows = 5;
  var gap = share ? '3px' : '4px';
  var cellMin = share ? '22px' : '28px';
  var iconSize = share ? '0.75em' : '0.8em';
  var pad = share ? '2px 2px' : '3px 2px';

  var html = '<div class="' + (share ? 'sp-share' : '') + '" style="position:relative;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.1);border-radius:10px;padding:' + (share ? '10px 8px 6px' : '14px 10px 8px') + '">';

  // Stage label
  html += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--bg,#1e293b);padding:0 8px;font-size:0.58em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">STAGE' + (share ? '' : ' — ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\'') + '</div>';
  if (_spShowDirections && !share) {
    html += '<div style="position:absolute;top:50%;left:-2px;transform:translateY(-50%) rotate(-90deg);font-size:0.45em;font-weight:700;color:rgba(255,255,255,0.06);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap">SL</div>';
    html += '<div style="position:absolute;top:50%;right:-2px;transform:translateY(-50%) rotate(90deg);font-size:0.45em;font-weight:700;color:rgba(255,255,255,0.06);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap">SR</div>';
    html += '<div style="position:absolute;top:3px;left:50%;transform:translateX(-50%);font-size:0.42em;font-weight:700;color:rgba(255,255,255,0.05);letter-spacing:0.08em;text-transform:uppercase">UPSTAGE</div>';
  }

  // Grid
  html += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:' + gap + '">';
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var el = plot.elements.find(function(e) { return e.x === c && e.y === r; });
      if (el) {
        var elIdx = plot.elements.indexOf(el);
        var isMoving = _spMoveIdx === elIdx;
        var rotation = el.rotation || 0;
        var rotStyle = rotation ? 'transform:rotate(' + rotation + 'deg)' : '';

        // Size class
        var baseLabel = el.label.split(' – ')[0].trim();
        var sc = SP_SIZE_CLASS[baseLabel] || 'sm';
        var cellBg = isMoving ? 'rgba(245,158,11,0.15)' : sc === 'lg' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)';
        var cellBorder = isMoving ? 'rgba(245,158,11,0.4)' : sc === 'lg' ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)';

        // Channel number
        var chNum = '';
        if (plot.channels) {
          for (var ci = 0; ci < plot.channels.length; ci++) {
            if (plot.channels[ci].label && el.label && plot.channels[ci].label.toLowerCase().indexOf(baseLabel.toLowerCase()) >= 0) {
              chNum = String(ci + 1); break;
            }
          }
          if (!chNum) {
            for (var cj = 0; cj < plot.channels.length; cj++) {
              if (plot.channels[cj].label && plot.channels[cj].label === el.label) { chNum = String(cj + 1); break; }
            }
          }
        }
        if (el.inputNum) chNum = el.inputNum;

        // Display label
        var displayLabel = share ? (SP_COMPACT[baseLabel] || baseLabel) : el.label;
        // For musician elements with "Name – Role", keep name in share mode
        if (share && el.label.indexOf(' – ') >= 0) {
          var parts = el.label.split(' – ');
          displayLabel = parts[0].split(' ')[0]; // first name only
          var roleAbbr = SP_COMPACT[parts[1].trim()] || parts[1].trim();
          displayLabel += ' ' + roleAbbr;
        }

        // Monitor mix label
        var mixLabel = '';
        if (_spShowLabels && !share && el.type === 'audio' && (el.label.indexOf('Monitor') >= 0 || el.label.indexOf('Wedge') >= 0 || el.label.indexOf('Floor') >= 0)) {
          if (plot.monitors) {
            for (var mi = 0; mi < plot.monitors.length; mi++) {
              if (plot.monitors[mi].label && el.label.indexOf(plot.monitors[mi].label.split(' ')[0]) >= 0) {
                mixLabel = ' M' + (mi + 1); break;
              }
            }
          }
          if (!mixLabel && el.inputNum) mixLabel = ' M' + el.inputNum;
        }

        html += '<div class="sp-cell" data-el-idx="' + elIdx + '"'
          + (share ? '' : ' draggable="true"'
              + ' ondragstart="_spDragStart(event,' + elIdx + ')"'
              + ' ondragend="_spDragEnd(event)"'
              + ' onclick="_spClickElement(' + elIdx + ')"'
              + ' ontouchstart="_spTouchStart(event,' + elIdx + ')"'
              + ' ontouchend="_spTouchEnd(event)"'
              + ' ontouchcancel="_spTouchEnd(event)"')
          + ' style="background:' + cellBg + ';border:1px solid ' + cellBorder + ';border-radius:5px;padding:' + pad + ';text-align:center;min-height:' + cellMin + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:' + (share ? 'default' : 'grab') + ';position:relative;overflow:hidden;touch-action:none">';
        html += '<span style="font-size:' + iconSize + ';line-height:1;' + rotStyle + '">' + el.icon + '</span>';
        if (_spShowLabels || share) {
          html += '<span style="font-size:' + (share ? '0.48em' : '0.52em') + ';font-weight:600;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:' + (share ? '60px' : '68px') + ';line-height:1.1">' + _spEsc(displayLabel) + mixLabel + '</span>';
        }
        if (chNum) html += '<span style="position:absolute;top:1px;left:1px;background:#667eea;color:white;font-size:0.42em;font-weight:800;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1">' + chNum + '</span>';
        if (!share) {
          html += '<button class="sp-del" onclick="event.stopPropagation();_spRemoveElement(' + elIdx + ')" style="position:absolute;top:0;right:1px;background:none;border:none;color:#64748b;cursor:pointer;font-size:0.5em;padding:1px">✕</button>';
        }
        html += '</div>';
      } else {
        // Empty cell — drag-drop target + tap-to-place
        if (share) {
          html += '<div style="min-height:' + cellMin + '"></div>';
        } else {
          var emptyLabel = _spMoveIdx >= 0 ? '↗' : (_spPendingElement ? '•' : '');
          var emptyBg = _spMoveIdx >= 0 ? 'rgba(245,158,11,0.03)' : 'transparent';
          html += '<div data-cell="' + c + ',' + r + '" ondragover="_spDragOver(event)" ondragleave="_spDragLeave(event)" ondrop="_spDrop(event,' + c + ',' + r + ')" style="background:' + emptyBg + ';border:1px dashed rgba(255,255,255,0.04);border-radius:4px;min-height:' + cellMin + ';display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="_spPlaceAtCell(' + c + ',' + r + ')"><span style="color:rgba(255,255,255,0.1);font-size:0.5em">' + emptyLabel + '</span></div>';
        }
      }
    }
  }
  html += '</div>';

  // Audience marker
  html += '<div style="text-align:center;margin-top:6px;font-size:0.52em;font-weight:700;color:rgba(255,255,255,0.12);letter-spacing:0.15em;text-transform:uppercase">';
  if (_spShowDirections && !share) html += '<span style="font-size:0.8em;color:rgba(255,255,255,0.05);margin-right:8px">DS</span>';
  html += '&#x25BC; AUDIENCE &#x25BC;';
  if (_spShowDirections && !share) html += '<span style="font-size:0.8em;color:rgba(255,255,255,0.05);margin-left:8px">DS</span>';
  html += '</div>';

  html += '</div>';
  return html;
}

function _spRenderChannelList(plot) {
  var html = '<div style="margin-top:20px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Input List</span>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button onclick="_spAddChannel()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add row</button>';
  html += '<button onclick="_spAutoBuildInputList()" title="Generate input list from placed mics/DIs on the stage" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);color:#a5b4fc;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em;font-weight:700">Auto from stage</button>';
  html += '</div></div>';

  if (!plot.channels || !plot.channels.length) {
    html += '<div style="color:var(--text-dim);font-size:0.8em;padding:8px">No inputs yet. Use "Auto from stage" to generate from placed mics, or "+ Add row" for a blank entry.</div>';
  } else {
    // Header row
    html += '<div style="display:grid;grid-template-columns:24px 1.5fr 1.5fr 60px 0.7fr 22px;gap:6px;padding:4px 0;font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase">';
    html += '<span style="text-align:right">#</span>';
    html += '<span>Source</span>';
    html += '<span>Mic / DI</span>';
    html += '<span>+48V</span>';
    html += '<span>Stand</span>';
    html += '<span></span>';
    html += '</div>';
    plot.channels.forEach(function(ch, i) {
      var micSpec = _spLookupMic(ch.mic);
      var phantom = ch.phantom !== undefined ? ch.phantom : (micSpec ? micSpec.phantom : false);
      var stand = ch.stand !== undefined ? ch.stand : (micSpec ? micSpec.stand : '');
      html += '<div style="display:grid;grid-template-columns:24px 1.5fr 1.5fr 60px 0.7fr 22px;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">';
      html += '<span style="font-size:0.75em;font-weight:700;color:var(--text-dim);text-align:right">' + (i + 1) + '</span>';
      html += '<input value="' + _spEsc(ch.label || '') + '" onchange="_spUpdateChannel(' + i + ',\'label\',this.value)" placeholder="Source (e.g. Brian vocal)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.78em;min-width:0">';
      html += '<select onchange="_spUpdateChannel(' + i + ',\'mic\',this.value)" class="sp-select" style="font-size:0.78em;padding:4px 6px;min-width:0">';
      html += '<option value=""' + (!ch.mic ? ' selected' : '') + '>—</option>';
      SP_MIC_LIBRARY.forEach(function(m) {
        html += '<option value="' + _spEsc(m.model) + '"' + (ch.mic === m.model ? ' selected' : '') + '>' + _spEsc(m.model) + '</option>';
      });
      html += '</select>';
      html += '<label style="display:flex;align-items:center;gap:3px;font-size:0.7em;color:var(--text-muted);cursor:pointer"><input type="checkbox"' + (phantom ? ' checked' : '') + ' onchange="_spUpdateChannel(' + i + ',\'phantom\',this.checked)" style="accent-color:#fbbf24"> 48V</label>';
      html += '<input value="' + _spEsc(stand) + '" onchange="_spUpdateChannel(' + i + ',\'stand\',this.value)" placeholder="Stand" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 6px;border-radius:4px;font-size:0.72em;min-width:0">';
      html += '<button onclick="_spRemoveChannel(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em">✕</button>';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}

function _spRenderMonitorMixes(plot) {
  var html = '<div style="margin-top:20px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Monitor Mixes</span>';
  html += '<button onclick="_spAddMonitor()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add</button>';
  html += '</div>';

  if (!plot.monitors || !plot.monitors.length) {
    html += '<div style="color:var(--text-dim);font-size:0.8em;padding:8px">No monitor mixes defined.</div>';
  } else {
    plot.monitors.forEach(function(mon, i) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
      html += '<span style="font-size:0.75em;font-weight:700;color:var(--text-dim)">Mix ' + (i + 1) + '</span>';
      html += '<input value="' + _spEsc(mon.label || '') + '" onchange="_spUpdateMonitor(' + i + ',this.value)" placeholder="e.g. Vocal heavy" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.8em">';
      html += '<button onclick="_spRemoveMonitor(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em">✕</button>';
      html += '</div>';
    });
  }
  html += '</div>';
  return html;
}

// ── Drag-and-drop (HTML5 + touch fallback) ──────────────────────────────────
// Lets the user drag any placed element to an empty cell directly. Replaces
// the old click-to-select-then-click-empty-cell flow with a fluent gesture
// while keeping the click flow intact (click without drag still opens the
// edit menu). Touch handlers mirror the same model for iPad/iPhone.

var _spDragIdx = -1;
var _spTouchEl = null;
var _spTouchTimer = null;
var _spTouchStartXY = null;

function _spDragStart(ev, idx) {
  _spDragIdx = idx;
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', String(idx)); } catch(e) {}
  }
  if (ev.target && ev.target.style) ev.target.style.opacity = '0.4';
}
function _spDragEnd(ev) {
  if (ev.target && ev.target.style) ev.target.style.opacity = '1';
  _spDragIdx = -1;
}
function _spDragOver(ev) {
  ev.preventDefault();
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
  if (ev.currentTarget && ev.currentTarget.style) ev.currentTarget.style.background = 'rgba(99,102,241,0.18)';
}
function _spDragLeave(ev) {
  if (ev.currentTarget && ev.currentTarget.style) ev.currentTarget.style.background = '';
}
function _spDrop(ev, x, y) {
  ev.preventDefault();
  if (ev.currentTarget && ev.currentTarget.style) ev.currentTarget.style.background = '';
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var idx = _spDragIdx;
  if (idx < 0) {
    var d = ev.dataTransfer && ev.dataTransfer.getData ? ev.dataTransfer.getData('text/plain') : '';
    idx = parseInt(d, 10);
  }
  if (isNaN(idx) || idx < 0 || !plot.elements[idx]) return;
  plot.elements[idx].x = x;
  plot.elements[idx].y = y;
  _spDragIdx = -1;
  _spDirty = true;
  _spRender();
}

// Touch — long-press starts drag, drag-finger-end finds drop target
function _spTouchStart(ev, idx) {
  if (!ev.touches || !ev.touches[0]) return;
  var t = ev.touches[0];
  _spTouchStartXY = { x: t.clientX, y: t.clientY };
  _spTouchEl = ev.currentTarget;
  // Long-press to begin drag (300ms). Single tap stays click-to-edit.
  _spTouchTimer = setTimeout(function() {
    _spDragIdx = idx;
    if (_spTouchEl && _spTouchEl.style) _spTouchEl.style.opacity = '0.4';
    if (typeof showToast === 'function') showToast('Drag to a new cell', 1500);
  }, 300);
}
function _spTouchEnd(ev) {
  if (_spTouchTimer) { clearTimeout(_spTouchTimer); _spTouchTimer = null; }
  if (_spTouchEl && _spTouchEl.style) _spTouchEl.style.opacity = '1';
  if (_spDragIdx < 0 || !ev.changedTouches || !ev.changedTouches[0]) {
    _spTouchEl = null;
    return;
  }
  var t = ev.changedTouches[0];
  var target = document.elementFromPoint(t.clientX, t.clientY);
  // Walk up to find a cell with data-cell="x,y"
  while (target && !target.dataset?.cell) target = target.parentElement;
  if (target && target.dataset.cell) {
    var parts = target.dataset.cell.split(',');
    _spDrop({ preventDefault: function(){}, currentTarget: target, dataTransfer: null }, parseInt(parts[0], 10), parseInt(parts[1], 10));
  } else {
    _spDragIdx = -1;
  }
  _spTouchEl = null;
}

window._spDragStart = _spDragStart;
window._spDragEnd = _spDragEnd;
window._spDragOver = _spDragOver;
window._spDragLeave = _spDragLeave;
window._spDrop = _spDrop;
window._spTouchStart = _spTouchStart;
window._spTouchEnd = _spTouchEnd;

// ── Interactions ─────────────────────────────────────────────────────────────

var _spPendingElement = null;

function _spAddElement(type, icon, label, mic) {
  _spMoveIdx = -1; // cancel any move in progress
  _spPendingElement = { type: type, icon: icon, label: label, mic: mic || '' };
  if (typeof showToast === 'function') showToast('Tap an empty cell to place ' + label);
  _spRender();
}

function _spPlaceAtCell(x, y) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  // Move mode: relocate existing element to this cell
  if (_spMoveIdx >= 0 && plot.elements[_spMoveIdx]) {
    plot.elements[_spMoveIdx].x = x;
    plot.elements[_spMoveIdx].y = y;
    _spMoveIdx = -1;
    _spDirty = true;
    _spRender();
    return;
  }
  // Place mode: new element
  if (_spPendingElement) {
    var newEl = {
      id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: _spPendingElement.type,
      icon: _spPendingElement.icon,
      label: _spPendingElement.label,
      x: x, y: y, rotation: 0
    };
    if (_spPendingElement.mic) newEl.mic = _spPendingElement.mic;
    plot.elements.push(newEl);
    _spPendingElement = null;
    _spDirty = true;
    _spRender();
  }
}

function _spRemoveElement(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  _spMoveIdx = -1;
  var removedEl = plot.elements[idx];
  plot.elements.splice(idx, 1);
  // Bidirectional sync: if this element auto-generated a channel row,
  // remove the channel too. Match by _autoFromElement === el.id.
  if (removedEl && removedEl.id && plot.channels) {
    plot.channels = plot.channels.filter(function(ch) {
      return ch._autoFromElement !== removedEl.id;
    });
  }
  _spDirty = true;
  _spRender();
}

/** Click on placed element: shows action menu (edit/move/rotate/input#) */
function _spClickElement(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.elements[idx]) return;
  var el = plot.elements[idx];

  // If already in move mode for this element, cancel
  if (_spMoveIdx === idx) { _spMoveIdx = -1; _spRender(); return; }

  var action = prompt(
    el.label + '\n\nChoose action:\n1 = Edit label\n2 = Move\n3 = Rotate\n4 = Set input #\n5 = Cancel',
    '1'
  );
  if (action === '1') {
    var newLabel = prompt('Edit label:', el.label);
    if (newLabel !== null) { el.label = newLabel; _spDirty = true; _spRender(); }
  } else if (action === '2') {
    _spMoveIdx = idx;
    if (typeof showToast === 'function') showToast('Tap an empty cell to move ' + el.label);
    _spRender();
  } else if (action === '3') {
    el.rotation = ((el.rotation || 0) + 90) % 360;
    _spDirty = true;
    _spRender();
  } else if (action === '4') {
    var num = prompt('Input/channel number (e.g. 3):', el.inputNum || '');
    if (num !== null) { el.inputNum = num.trim(); _spDirty = true; _spRender(); }
  }
}

function _spApplyPreset(name) {
  var preset = SP_PRESETS[name];
  if (!preset) return;
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.stageWidth = preset.w;
  plot.stageDepth = preset.d;
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('Stage: ' + preset.w + '\' x ' + preset.d + '\'');
}

function _spAddChannel() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.channels) plot.channels = [];
  plot.channels.push({ label: '', source: '' });
  _spDirty = true;
  _spRender();
}

function _spUpdateChannel(idx, fieldOrVal, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.channels[idx]) return;
  // Backward-compat: 2-arg form (idx, value) sets the label.
  // New 3-arg form (idx, fieldName, value) sets a specific field.
  if (val === undefined) {
    plot.channels[idx].label = fieldOrVal;
  } else {
    plot.channels[idx][fieldOrVal] = val;
    // Auto-fill phantom + stand defaults when mic changes
    if (fieldOrVal === 'mic') {
      var spec = _spLookupMic(val);
      if (spec) {
        if (plot.channels[idx].phantom === undefined) plot.channels[idx].phantom = spec.phantom;
        if (!plot.channels[idx].stand) plot.channels[idx].stand = spec.stand;
      }
    }
  }
  _spDirty = true;
  _spRender();
}

// Build input list automatically from placed mic/DI elements on the stage.
// Generates one channel row per audio element, populating mic model from
// the element's mic field (if set), then deduces phantom + stand from
// the mic library.
function _spAutoBuildInputList() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var srcEls = (plot.elements || []).filter(function(el) {
    if (el.type !== 'audio') return false;
    var lower = (el.label || '').toLowerCase();
    return lower.indexOf('mic') >= 0 || lower.indexOf('di') >= 0;
  });
  if (!srcEls.length) {
    if (typeof showToast === 'function') showToast('No mics or DIs placed on the stage yet.');
    return;
  }
  if (plot.channels && plot.channels.length && !confirm('Replace existing ' + plot.channels.length + ' input row' + (plot.channels.length === 1 ? '' : 's') + ' with auto-built list from placed mics?')) {
    return;
  }
  // Sort by stage position (back-to-front, left-to-right) so input list
  // mirrors what FOH sees physically.
  srcEls.sort(function(a, b) {
    if ((a.y || 0) !== (b.y || 0)) return (a.y || 0) - (b.y || 0);
    return (a.x || 0) - (b.x || 0);
  });
  plot.channels = srcEls.map(function(el, i) {
    var micModel = el.mic || '';
    var spec = _spLookupMic(micModel);
    var label = el.label || '';
    // If the element label looks like a generic name, try to enrich with
    // band-member context from extra field.
    if (el.assignedTo) label = el.assignedTo + ' — ' + label;
    return {
      label: label,
      source: '',
      mic: micModel,
      phantom: spec ? spec.phantom : false,
      stand: spec ? spec.stand : '',
      _autoFromElement: el.id || ('el_' + i)
    };
  });
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('✓ Built ' + plot.channels.length + ' input rows from placed mics');
}

window._spAutoBuildInputList = _spAutoBuildInputList;

function _spRemoveChannel(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.channels.splice(idx, 1);
  _spDirty = true;
  _spRender();
}

function _spAddMonitor() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.monitors) plot.monitors = [];
  plot.monitors.push({ label: '' });
  _spDirty = true;
  _spRender();
}

function _spUpdateMonitor(idx, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.monitors[idx]) return;
  plot.monitors[idx].label = val;
  _spDirty = true;
}

function _spRemoveMonitor(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.monitors.splice(idx, 1);
  _spDirty = true;
  _spRender();
}

function _spAddPlot() {
  var name = prompt('Layout name:', 'New Layout');
  if (!name) return;
  _spPlots.push({
    id: 'plot_' + Date.now(),
    name: name,
    stageWidth: 24,
    stageDepth: 16,
    elements: [],
    channels: [],
    monitors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  _spCurrentIdx = _spPlots.length - 1;
  _spDirty = true;
  _spRender();
}

function _spSwitchPlot(idx) {
  _spCurrentIdx = parseInt(idx);
  _spRender();
}

function _spDuplicatePlot() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var copy = JSON.parse(JSON.stringify(plot));
  copy.id = 'plot_' + Date.now();
  copy.name = plot.name + ' (copy)';
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();
  _spPlots.push(copy);
  _spCurrentIdx = _spPlots.length - 1;
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('Layout duplicated');
}

function _spRenamePlot() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var newName = prompt('Rename stage plot:', plot.name);
  if (newName !== null && newName.trim() !== '') {
    plot.name = newName.trim();
    _spDirty = true;
    _spRender();
    if (typeof showToast === 'function') showToast('Renamed to "' + plot.name + '"');
  }
}

function _spSaveAs() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var newName = prompt('Save a copy as:', plot.name + ' (copy)');
  if (newName === null || newName.trim() === '') return;
  var copy = JSON.parse(JSON.stringify(plot));
  copy.id = 'plot_' + Date.now();
  copy.name = newName.trim();
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();
  _spPlots.push(copy);
  _spCurrentIdx = _spPlots.length - 1;
  _spDirty = true;
  _spSave();
  _spRender();
  if (typeof showToast === 'function') showToast('Saved as "' + copy.name + '"');
}

function _spResetToDefault() {
  if (!confirm('Reset this layout to band default positions?')) return;
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.elements = [];
  var col = 1;
  if (typeof bandMembers !== 'undefined') {
    Object.entries(bandMembers).forEach(function(e) {
      var m = e[1];
      var icon = m.role === 'Drums' ? '🥁' : m.role === 'Keyboard' ? '🎹' : '🎸';
      var row = m.role === 'Drums' ? 1 : 2;
      plot.elements.push({ type: 'musician', icon: icon, label: m.name + ' – ' + m.role, x: col, y: row });
      col++;
    });
  }
  _spDirty = true;
  _spRender();
}

function _spUpdateRiderNotes(val) {
  var plot = _spPlots[_spCurrentIdx];
  if (plot) { plot.riderNotes = val; _spDirty = true; }
}

function _spUpdateContact(val) {
  var plot = _spPlots[_spCurrentIdx];
  if (plot) { plot.contact = val; _spDirty = true; }
}

function _spUpdateBrandColor(val) {
  var plot = _spPlots[_spCurrentIdx];
  if (plot) { plot.brandColor = val; _spDirty = true; _spRender(); }
}

function _spUploadBrandLogo(input) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !input.files || !input.files[0]) return;
  var file = input.files[0];
  if (file.size > 500 * 1024) {
    if (typeof showToast === 'function') showToast('⚠ Logo too large — keep under 500KB');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    plot.brandLogo = e.target.result;
    _spDirty = true;
    _spRender();
    if (typeof showToast === 'function') showToast('✓ Logo added');
  };
  reader.readAsDataURL(file);
}

function _spClearBrandLogo() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  delete plot.brandLogo;
  _spDirty = true;
  _spRender();
}

window._spUpdateBrandColor = _spUpdateBrandColor;
window._spUploadBrandLogo = _spUploadBrandLogo;
window._spClearBrandLogo = _spClearBrandLogo;

// ── Linked gig + set variant ───────────────────────────────────────────────
async function _spLinkToGig() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (typeof loadBandDataFromDrive !== 'function') return;
  var gigs = [];
  try {
    var raw = await loadBandDataFromDrive('_band', 'gigs');
    if (Array.isArray(raw)) gigs = raw;
    else if (raw) gigs = Object.values(raw);
  } catch (e) {}
  if (!gigs.length) {
    if (typeof showToast === 'function') showToast('No gigs in your calendar yet — add a gig first.', 4000);
    return;
  }
  // Sort by date descending (most recent / next first)
  gigs.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  var lines = ['Pick a gig to link this stage plot to:\n'];
  gigs.slice(0, 30).forEach(function(g, i) {
    lines.push((i + 1) + '. ' + (g.date || '?') + '  ' + (g.venue || '(no venue)'));
  });
  lines.push('\nEnter the number (or 0 to cancel):');
  var pick = prompt(lines.join('\n'), '1');
  if (!pick) return;
  var num = parseInt(pick, 10);
  if (!num || num < 1 || num > gigs.length) return;
  var picked = gigs[num - 1];
  plot.linkedGigId = picked.gigId || picked.id || null;
  plot.linkedGigVenue = (picked.venue || '') + (picked.date ? ' · ' + picked.date : '');
  plot.linkedGigDate = picked.date || '';
  plot.linkedSetlistId = picked.setlistId || null;
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('✓ Linked to ' + plot.linkedGigVenue);
}

function _spUnlinkGig() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  delete plot.linkedGigId;
  delete plot.linkedGigVenue;
  delete plot.linkedGigDate;
  delete plot.linkedSetlistId;
  _spDirty = true;
  _spRender();
}

function _spEditSetVariant() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var current = plot.setVariantLabel || '';
  var label = prompt('Tag this plot as a specific set or song range?\n\nExamples:\n  "Set 1"\n  "Acoustic opener"\n  "Songs 1–4"\n  "Festival headliner"\n\nLeave blank if this plot covers the whole gig.', current);
  if (label === null) return;
  if (label.trim()) plot.setVariantLabel = label.trim();
  else delete plot.setVariantLabel;
  _spDirty = true;
  _spRender();
}

window._spLinkToGig = _spLinkToGig;
window._spUnlinkGig = _spUnlinkGig;
window._spEditSetVariant = _spEditSetVariant;

// ── Show-day checklist ─────────────────────────────────────────────────────
var SP_DEFAULT_CHECKLIST = [
  'Load in — power confirmed',
  'Backline placed per stage plot',
  'Lines run + DI / mics patched',
  'Line check — every channel passes',
  'Soundcheck — instruments solo + together',
  'Monitor mixes confirmed with each member',
  'IEM batteries / wireless freq scan',
  'Setlist taped to floor',
  'Water on stage',
  'Set break audio + interlude ready',
  'Encore plan briefed'
];

function _spChecklistAdd() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.checklist) plot.checklist = [];
  var label = prompt('Checklist item:', '');
  if (!label || !label.trim()) return;
  plot.checklist.push({ label: label.trim(), done: false });
  _spDirty = true;
  _spRender();
}

function _spChecklistSeedDefaults() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.checklist = SP_DEFAULT_CHECKLIST.map(function(s) { return { label: s, done: false }; });
  _spDirty = true;
  _spRender();
}

function _spChecklistToggle(i, done) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.checklist || !plot.checklist[i]) return;
  plot.checklist[i].done = !!done;
  _spDirty = true;
}

function _spChecklistEdit(i, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.checklist || !plot.checklist[i]) return;
  plot.checklist[i].label = val;
  _spDirty = true;
}

function _spChecklistRemove(i) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.checklist) return;
  plot.checklist.splice(i, 1);
  _spDirty = true;
  _spRender();
}

function _spChecklistResetAll() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.checklist) return;
  if (!confirm('Uncheck every item? Use this at the start of a new gig.')) return;
  plot.checklist.forEach(function(it) { it.done = false; });
  _spDirty = true;
  _spRender();
  if (typeof showToast === 'function') showToast('Checklist reset for new gig');
}

window._spChecklistAdd = _spChecklistAdd;
window._spChecklistSeedDefaults = _spChecklistSeedDefaults;
window._spChecklistToggle = _spChecklistToggle;
window._spChecklistEdit = _spChecklistEdit;
window._spChecklistRemove = _spChecklistRemove;
window._spChecklistResetAll = _spChecklistResetAll;

async function _spSave() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.updatedAt = new Date().toISOString();
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath('stage_plots')).set(_spPlots);
      _spDirty = false;
      if (typeof showToast === 'function') showToast('✅ Stage plot saved');
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('❌ Save failed: ' + e.message);
  }
}

// ── Share Mode Details (read-only compact view) ─────────────────────────────

function _spRenderShareDetails(plot) {
  var html = '';
  // Channel list (compact table)
  if (plot.channels && plot.channels.length) {
    html += '<div style="margin-top:12px"><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Input List</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:2px">';
    plot.channels.forEach(function(ch, i) {
      html += '<div style="font-size:0.72em;color:var(--text-muted);padding:2px 0"><span style="font-weight:700;color:var(--text-dim);margin-right:4px">' + (i + 1) + '.</span>' + _spEsc(ch.label || '—') + '</div>';
    });
    html += '</div></div>';
  }
  // Monitors (compact)
  if (plot.monitors && plot.monitors.length) {
    html += '<div style="margin-top:10px"><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Monitor Mixes</div>';
    plot.monitors.forEach(function(mon, i) {
      html += '<div style="font-size:0.72em;color:var(--text-muted);padding:1px 0"><span style="font-weight:700;color:var(--text-dim)">Mix ' + (i + 1) + ':</span> ' + _spEsc(mon.label || '—') + '</div>';
    });
    html += '</div>';
  }
  // Rider notes
  if (plot.riderNotes) {
    html += '<div style="margin-top:10px"><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Tech Notes</div>';
    html += '<div style="font-size:0.72em;color:var(--text-muted);white-space:pre-wrap;line-height:1.4">' + _spEsc(plot.riderNotes) + '</div></div>';
  }
  // Contact
  if (plot.contact) {
    html += '<div style="margin-top:8px;font-size:0.68em;color:var(--text-dim)">Contact: ' + _spEsc(plot.contact) + '</div>';
  }
  return html;
}

// ── Export / Print View ──────────────────────────────────────────────────────

// Generate a deep link to this plot. Format: #stageplot-share/{plotId}.
// When the app loads with this hash, it auto-jumps to the stage plot
// page and selects/displays the plot in share mode. Always shows the
// current Firebase state, so the venue's bookmark stays fresh.
function _spCopyShareLink() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var base = window.location.origin + window.location.pathname;
  var url = base + '#stageplot-share/' + encodeURIComponent(plot.id);
  // Save current state first so the link points at fresh data.
  if (_spDirty) _spSave();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      if (typeof showToast === 'function') showToast('✓ Share link copied — paste into a text/email. Always shows the current plot.', 5000);
    }).catch(function() {
      _spShareLinkFallback(url);
    });
  } else {
    _spShareLinkFallback(url);
  }
}

function _spShareLinkFallback(url) {
  try {
    var ta = document.createElement('textarea');
    ta.value = url;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (typeof showToast === 'function') showToast('✓ Share link copied');
  } catch(e) {
    prompt('Copy this link:', url);
  }
}

// On page load, if the URL hash matches the stageplot-share pattern,
// jump to the stage plot page in share mode. The plot data still comes
// from Firebase (same as normal load), so the link always reflects the
// current state.
function _spCheckSharedHash() {
  var hash = window.location.hash || '';
  var match = hash.match(/^#stageplot-share\/(.+)$/);
  if (!match) return false;
  var plotId = decodeURIComponent(match[1]);
  // Force share mode so the recipient gets the read-only view by default.
  _spShareMode = true;
  // Navigate to the stage plot page; loadPlots will then pick up plotId.
  window._spPendingShareId = plotId;
  if (typeof showPage === 'function') showPage('stageplot');
  return true;
}

window._spCopyShareLink = _spCopyShareLink;

// Wire the hash-route check at load + on hash changes
window.addEventListener('hashchange', function() { _spCheckSharedHash(); });

function _spExportView() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var bandName = localStorage.getItem('deadcetera_band_name') || 'GrooveLinx';
  var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var brandColor = plot.brandColor || '#667eea';
  var logoTag = plot.brandLogo ? '<img src="' + plot.brandLogo + '" style="max-height:48px;max-width:140px;background:#fff;padding:4px;border-radius:4px;margin-bottom:8px">' : '';

  // Build printable HTML — compact grid matching share mode density
  var cols = Math.min(10, Math.max(6, plot.elements.length + 2));
  var rows = 5;

  var stageHTML = '<table style="width:100%;border-collapse:collapse;margin:12px 0">';
  for (var r = 0; r < rows; r++) {
    stageHTML += '<tr>';
    for (var c = 0; c < cols; c++) {
      var el = plot.elements.find(function(e) { return e.x === c && e.y === r; });
      var baseLabel = el ? el.label.split(' – ')[0].trim() : '';
      var compactLabel = el ? (el.label.indexOf(' – ') >= 0 ? el.label.split(' – ')[0].split(' ')[0] + ' ' + (SP_COMPACT[el.label.split(' – ')[1].trim()] || el.label.split(' – ')[1].trim()) : (SP_COMPACT[baseLabel] || el.label)) : '';
      stageHTML += '<td style="border:1px solid #ddd;padding:4px 3px;text-align:center;min-width:55px;height:32px;vertical-align:middle;font-size:11px">';
      if (el) stageHTML += '<div style="font-size:1em">' + el.icon + '</div><div style="font-size:0.7em;font-weight:600;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _spEsc(compactLabel) + '</div>';
      stageHTML += '</td>';
    }
    stageHTML += '</tr>';
  }
  stageHTML += '</table>';

  // Multi-page PDF: page-break-after on each section so the user gets a
  // 2-4 page document depending on what's filled in. Each page is letter-
  // sized A4 friendly. Branding (logo + accent color) appears on each page.

  var headerBar = function(subtitle) {
    return '<div style="border-bottom:3px solid ' + brandColor + ';padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:14px">'
      + '<div>'
      + (logoTag || '')
      + '<h1 style="font-size:22px;margin:0;color:#111">' + _spEsc(bandName) + '</h1>'
      + '<div style="font-size:13px;color:' + brandColor + ';font-weight:700;margin-top:2px">' + _spEsc(plot.name) + ' — ' + subtitle + '</div>'
      + '</div>'
      + '<div style="font-size:11px;color:#666;text-align:right">'
      + 'Stage ' + plot.stageWidth + '\' × ' + plot.stageDepth + '\'<br>'
      + 'Exported ' + date
      + '</div>'
      + '</div>';
  };

  // Page 1: Stage plot
  var page1 = '<section style="page-break-after:always">'
    + headerBar('Stage Plot')
    + stageHTML
    + '<div style="text-align:center;font-size:11px;color:#999;margin-top:-4px">▼ AUDIENCE ▼</div>';
  if (plot.contact) page1 += '<div style="margin-top:24px;font-size:13px;color:#444"><strong style="color:' + brandColor + '">Contact:</strong> ' + _spEsc(plot.contact) + '</div>';
  page1 += '</section>';

  // Page 2: Input list — full-detail with mic, phantom, stand
  var page2 = '';
  if (plot.channels && plot.channels.length) {
    page2 = '<section style="page-break-after:always">'
      + headerBar('Input List')
      + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:' + brandColor + ';color:#fff">'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:right;width:40px">#</th>'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:left">Source</th>'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:left">Mic / DI</th>'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:center;width:50px">+48V</th>'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:left;width:120px">Stand</th>'
      + '</tr></thead><tbody>';
    plot.channels.forEach(function(ch, i) {
      var spec = _spLookupMic(ch.mic);
      var phantom = ch.phantom !== undefined ? ch.phantom : (spec ? spec.phantom : false);
      var stand = ch.stand !== undefined ? ch.stand : (spec ? spec.stand : '');
      page2 += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '">'
        + '<td style="border:1px solid #ddd;padding:5px 8px;text-align:right;font-weight:700;color:' + brandColor + '">' + (i + 1) + '</td>'
        + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(ch.label || '') + '</td>'
        + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(ch.mic || '—') + '</td>'
        + '<td style="border:1px solid #ddd;padding:5px 8px;text-align:center;font-weight:700">' + (phantom ? '✓' : '') + '</td>'
        + '<td style="border:1px solid #ddd;padding:5px 8px;font-size:11px;color:#555">' + _spEsc(stand) + '</td>'
        + '</tr>';
    });
    page2 += '</tbody></table>'
      + '<div style="font-size:10px;color:#888;margin-top:8px;font-style:italic">+48V column flags channels needing phantom power. Stand column shows the typical stand for that mic. Mic spec follows Shure / Sennheiser / AKG / AT / Royer industry conventions.</div>'
      + '</section>';
  }

  // Page 3: Monitor mixes
  var page3 = '';
  if (plot.monitors && plot.monitors.length) {
    page3 = '<section style="page-break-after:always">'
      + headerBar('Monitor Mixes')
      + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:' + brandColor + ';color:#fff">'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:left;width:80px">Mix</th>'
      + '<th style="border:1px solid ' + brandColor + ';padding:6px 8px;text-align:left">Contents / Notes</th>'
      + '</tr></thead><tbody>';
    plot.monitors.forEach(function(mon, i) {
      page3 += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '">'
        + '<td style="border:1px solid #ddd;padding:5px 8px;font-weight:700;color:' + brandColor + '">Mix ' + (i + 1) + '</td>'
        + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(mon.label || '') + '</td>'
        + '</tr>';
    });
    page3 += '</tbody></table></section>';
  }

  // Page 4: Rider + contact
  var page4 = '';
  if (plot.riderNotes || plot.contact) {
    page4 = '<section>' + headerBar('Tech Rider');
    if (plot.riderNotes) {
      page4 += '<div style="white-space:pre-wrap;font-size:12px;line-height:1.6;border-left:3px solid ' + brandColor + ';padding:6px 14px;background:#f9f9fb;border-radius:0 4px 4px 0;margin-bottom:14px">' + _spEsc(plot.riderNotes) + '</div>';
    }
    if (plot.contact) {
      page4 += '<div style="font-size:13px;color:#222;padding:10px;border:1px solid #ddd;border-radius:4px;background:#fff"><strong style="color:' + brandColor + '">Band Contact:</strong><br>' + _spEsc(plot.contact) + '</div>';
    }
    page4 += '</section>';
  }

  var printHTML = '<!DOCTYPE html><html><head><title>' + _spEsc(bandName) + ' — ' + _spEsc(plot.name) + '</title>'
    + '<style>'
    + 'body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fff}'
    + 'h1{font-size:22px;margin:0}'
    + 'section{margin-bottom:24px}'
    + '@media print{body{padding:0;max-width:none}button{display:none!important}section{page-break-after:always}section:last-of-type{page-break-after:auto}}'
    + '</style></head><body>'
    + page1
    + page2
    + page3
    + page4
    + '<button onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:' + brandColor + ';color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.2)">🖨 Print / Save as PDF</button>'
    + '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(printHTML);
    win.document.close();
  } else {
    if (typeof showToast === 'function') showToast('Pop-up blocked — allow pop-ups to export');
  }
}

function _spEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Register + Exports ──────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
  pageRenderers.stageplot = renderStagePlotPage;
}

window.renderStagePlotPage = renderStagePlotPage;
window._spAddElement = _spAddElement;
window._spPlaceAtCell = _spPlaceAtCell;
window._spRemoveElement = _spRemoveElement;
window._spAddChannel = _spAddChannel;
window._spUpdateChannel = _spUpdateChannel;
window._spRemoveChannel = _spRemoveChannel;
window._spAddMonitor = _spAddMonitor;
window._spUpdateMonitor = _spUpdateMonitor;
window._spRemoveMonitor = _spRemoveMonitor;
window._spAddPlot = _spAddPlot;
window._spSwitchPlot = _spSwitchPlot;
window._spSave = _spSave;
window._spDuplicatePlot = _spDuplicatePlot;
window._spRenamePlot = _spRenamePlot;
window._spSaveAs = _spSaveAs;
window._spResetToDefault = _spResetToDefault;
window._spUpdateRiderNotes = _spUpdateRiderNotes;
window._spUpdateContact = _spUpdateContact;
window._spExportView = _spExportView;
window._spClickElement = _spClickElement;
window._spApplyPreset = _spApplyPreset;
window._spToggleLabels = function(v) { _spShowLabels = v; _spRender(); };
window._spToggleDirections = function(v) { _spShowDirections = v; _spRender(); };
window._spToggleShareMode = function() { _spShareMode = !_spShareMode; _spRender(); };
window._spAddStation = _spAddStation;
window._spRemoveStation = _spRemoveStation;
window._spClickStation = _spClickStation;
window._spPlaceStationAtCell = _spPlaceStationAtCell;
window._spConvertToStations = _spConvertToStations;
window._spConvertToLegacy = function() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.layoutMode = 'legacy';
  _spDirty = true;
  _spRender();
};

console.log('🎭 stage-plot.js loaded');
