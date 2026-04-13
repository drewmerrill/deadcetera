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
    { type: 'audio', icon: '🎙️', label: 'Vocal Mic' },
    { type: 'audio', icon: '🎙️', label: 'Inst Mic' },
    { type: 'audio', icon: '📦', label: 'DI Box' },
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

  html += '<span style="font-size:' + (share ? '0.7em' : '0.75em') + ';line-height:1">' + roleIcon + '</span>';
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

  _spCurrentIdx = 0;
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
          html += '<button onclick="_spAddElement(\'' + el.type + '\',\'' + _spEsc(el.icon) + '\',\'' + _spEsc(el.label) + '\')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 6px;border-radius:5px;cursor:pointer;font-size:0.68em;display:flex;align-items:center;gap:3px"><span style="font-size:0.9em">' + el.icon + '</span><span>' + el.label + '</span></button>';
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

        html += '<div class="sp-cell" style="background:' + cellBg + ';border:1px solid ' + cellBorder + ';border-radius:5px;padding:' + pad + ';text-align:center;min-height:' + cellMin + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:' + (share ? 'default' : 'pointer') + ';position:relative;overflow:hidden"' + (share ? '' : ' onclick="_spClickElement(' + elIdx + ')"') + '>';
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
        // Empty cell
        if (share) {
          html += '<div style="min-height:' + cellMin + '"></div>';
        } else {
          var emptyLabel = _spMoveIdx >= 0 ? '↗' : (_spPendingElement ? '•' : '');
          var emptyBg = _spMoveIdx >= 0 ? 'rgba(245,158,11,0.03)' : 'transparent';
          html += '<div style="background:' + emptyBg + ';border:1px dashed rgba(255,255,255,0.04);border-radius:4px;min-height:' + cellMin + ';display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="_spPlaceAtCell(' + c + ',' + r + ')"><span style="color:rgba(255,255,255,0.1);font-size:0.5em">' + emptyLabel + '</span></div>';
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
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Channel List</span>';
  html += '<button onclick="_spAddChannel()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add</button>';
  html += '</div>';

  if (!plot.channels || !plot.channels.length) {
    html += '<div style="color:var(--text-dim);font-size:0.8em;padding:8px">No channels yet. Add channels for your input list.</div>';
  } else {
    plot.channels.forEach(function(ch, i) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
      html += '<span style="font-size:0.75em;font-weight:700;color:var(--text-dim);width:24px;text-align:right">' + (i + 1) + '</span>';
      html += '<input value="' + _spEsc(ch.label || '') + '" onchange="_spUpdateChannel(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.8em">';
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

// ── Interactions ─────────────────────────────────────────────────────────────

var _spPendingElement = null;

function _spAddElement(type, icon, label) {
  _spMoveIdx = -1; // cancel any move in progress
  _spPendingElement = { type: type, icon: icon, label: label };
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
    plot.elements.push({ type: _spPendingElement.type, icon: _spPendingElement.icon, label: _spPendingElement.label, x: x, y: y, rotation: 0 });
    _spPendingElement = null;
    _spDirty = true;
    _spRender();
  }
}

function _spRemoveElement(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  _spMoveIdx = -1;
  plot.elements.splice(idx, 1);
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

function _spUpdateChannel(idx, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.channels[idx]) return;
  plot.channels[idx].label = val;
  _spDirty = true;
}

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

function _spExportView() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var bandName = localStorage.getItem('deadcetera_band_name') || 'GrooveLinx';
  var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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

  var channelHTML = '';
  if (plot.channels && plot.channels.length) {
    channelHTML = '<h3 style="margin:16px 0 8px;font-size:14px">Channel List</h3><table style="width:100%;border-collapse:collapse">';
    plot.channels.forEach(function(ch, i) {
      channelHTML += '<tr><td style="border:1px solid #ddd;padding:4px 8px;width:30px;text-align:right;font-weight:700">' + (i + 1) + '</td><td style="border:1px solid #ddd;padding:4px 8px">' + _spEsc(ch.label || '') + '</td></tr>';
    });
    channelHTML += '</table>';
  }

  var monitorHTML = '';
  if (plot.monitors && plot.monitors.length) {
    monitorHTML = '<h3 style="margin:16px 0 8px;font-size:14px">Monitor Mixes</h3><table style="width:100%;border-collapse:collapse">';
    plot.monitors.forEach(function(mon, i) {
      monitorHTML += '<tr><td style="border:1px solid #ddd;padding:4px 8px;width:50px;font-weight:700">Mix ' + (i + 1) + '</td><td style="border:1px solid #ddd;padding:4px 8px">' + _spEsc(mon.label || '') + '</td></tr>';
    });
    monitorHTML += '</table>';
  }

  var riderHTML = '';
  if (plot.riderNotes) {
    riderHTML = '<h3 style="margin:16px 0 8px;font-size:14px">Tech Rider Notes</h3><div style="white-space:pre-wrap;font-size:12px;border:1px solid #ddd;padding:10px;border-radius:4px">' + _spEsc(plot.riderNotes) + '</div>';
  }

  var contactHTML = '';
  if (plot.contact) {
    contactHTML = '<div style="margin-top:16px;font-size:12px;color:#666">Contact: ' + _spEsc(plot.contact) + '</div>';
  }

  var printHTML = '<!DOCTYPE html><html><head><title>' + _spEsc(bandName) + ' — ' + _spEsc(plot.name) + '</title>'
    + '<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1a1a1a}h1{font-size:20px;margin:0}h2{font-size:16px;color:#666;margin:4px 0 16px}@media print{button{display:none}}</style></head><body>'
    + '<h1>' + _spEsc(bandName) + '</h1>'
    + '<h2>' + _spEsc(plot.name) + ' — Stage Plot</h2>'
    + '<div style="font-size:11px;color:#999;margin-bottom:12px">Stage: ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\' | Exported: ' + date + '</div>'
    + stageHTML
    + '<div style="text-align:center;font-size:11px;color:#999;margin-top:-8px">▼ AUDIENCE ▼</div>'
    + channelHTML
    + monitorHTML
    + riderHTML
    + contactHTML
    + '<button onclick="window.print()" style="margin-top:20px;padding:8px 20px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:700">Print / Save as PDF</button>'
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
