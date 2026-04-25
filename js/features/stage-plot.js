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

  // Avatar — uses uploaded photo if available, else colored initials.
  // Photo is per-station (band members can have different photos per plot
  // if they dress differently for different gigs, which sometimes happens).
  var avatarSize = share ? '14px' : '18px';
  var avatarHtml;
  if (station.photo) {
    avatarHtml = '<div style="width:' + avatarSize + ';height:' + avatarSize + ';border-radius:50%;background-image:url(\'' + station.photo + '\');background-size:cover;background-position:center;flex-shrink:0;border:1px solid rgba(255,255,255,0.15)"></div>';
  } else {
    var initials = _spInitials(station.musicianName);
    var avatarColor = _spInitialsColor(station.musicianName);
    avatarHtml = '<div style="width:' + avatarSize + ';height:' + avatarSize + ';border-radius:50%;background:' + avatarColor + ';color:#fff;font-size:' + (share ? '0.42em' : '0.5em') + ';font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + _spEsc(initials) + '</div>';
  }
  html += '<div style="display:flex;align-items:center;gap:3px;line-height:1">'
    + avatarHtml
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
    st.musicianName + ' (' + st.role + ')\n\n1 = Edit name/role\n2 = Move\n3 = Toggle pedalboard\n4 = Toggle mic\n5 = Toggle monitor\n6 = Change monitor type\n7 = Change size\n8 = Upload photo' + (st.photo ? ' (replace)' : '') + '\n9 = Remove photo\n0 = Cancel',
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
  } else if (action === '8') {
    // Trigger a hidden file input for photo upload — capped at 200KB so
    // Firebase docs don't bloat. Resized client-side via canvas before save.
    var fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.onchange = function() {
      if (!fi.files || !fi.files[0]) return;
      _spReadAndResizePhoto(fi.files[0], function(dataUrl) {
        st.photo = dataUrl;
        _spDirty = true;
        _spRender();
        if (typeof showToast === 'function') showToast('✓ Photo uploaded');
      });
    };
    fi.click();
  } else if (action === '9') {
    if (st.photo) { delete st.photo; _spDirty = true; _spRender(); }
  }
}

// Resize an uploaded image to 96×96px JPEG via canvas, returns data URL.
// Keeps Firebase doc size manageable (~5KB per photo) while still being
// crisp at the avatar render size.
function _spReadAndResizePhoto(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var size = 96;
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      // Center-crop to square then scale to 96x96
      var src = img.width > img.height
        ? { sx: (img.width - img.height) / 2, sy: 0, sw: img.height, sh: img.height }
        : { sx: 0, sy: (img.height - img.width) / 2, sw: img.width, sh: img.width };
      ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, 0, 0, size, size);
      callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
      window._spPlotsCache = _spPlots;
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
    html += '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">';
    html += '<label for="spToggleLabels" style="display:flex;align-items:center;gap:4px;font-size:0.68em;color:var(--text-dim);cursor:pointer"><input type="checkbox" id="spToggleLabels" name="spLabels" ' + (_spShowLabels ? 'checked' : '') + ' onchange="_spToggleLabels(this.checked)" style="accent-color:#667eea"> Labels</label>';
    html += '<label for="spToggleDirections" style="display:flex;align-items:center;gap:4px;font-size:0.68em;color:var(--text-dim);cursor:pointer"><input type="checkbox" id="spToggleDirections" name="spDirections" ' + (_spShowDirections ? 'checked' : '') + ' onchange="_spToggleDirections(this.checked)" style="accent-color:#667eea"> Stage directions</label>';
    if (!isStationMode) {
      var placementMode = plot.placementMode || 'grid';
      html += '<span style="margin-left:auto;display:inline-flex;border:1px solid rgba(255,255,255,0.1);border-radius:6px;overflow:hidden">'
        + '<button onclick="_spSetPlacementMode(\'grid\')" style="font-size:0.68em;padding:3px 10px;border:none;cursor:pointer;background:' + (placementMode === 'grid' ? 'rgba(99,102,241,0.18)' : 'transparent') + ';color:' + (placementMode === 'grid' ? '#a5b4fc' : 'var(--text-dim)') + ';font-weight:700">⊞ Grid</button>'
        + '<button onclick="_spSetPlacementMode(\'free\')" style="font-size:0.68em;padding:3px 10px;border:none;border-left:1px solid rgba(255,255,255,0.1);cursor:pointer;background:' + (placementMode === 'free' ? 'rgba(99,102,241,0.18)' : 'transparent') + ';color:' + (placementMode === 'free' ? '#a5b4fc' : 'var(--text-dim)') + ';font-weight:700">✦ Free</button>'
        + '</span>';
    }
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
  var isFreeMode = plot.placementMode === 'free' && !isStationMode;
  html += isStationMode ? _spRenderStationLayout(plot)
    : isFreeMode ? _spRenderStageFree(plot)
    : _spRenderStage(plot);

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

    // Cable runs summary
    html += _spRenderCableSummary(plot);

    // Monitor mixes
    html += _spRenderMonitorMixes(plot);

    // Setup time + load-in window — promoters always ask. Two short text
    // fields prominent on the rider so they get answered upfront.
    html += '<div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    html += '<div>'
      + '<div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Setup / soundcheck time needed</div>'
      + '<input value="' + _spEsc(plot.setupTime || '') + '" onchange="_spUpdatePlotField(\'setupTime\',this.value)" placeholder="e.g. 60 min setup + 30 min soundcheck" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:6px 10px;border-radius:6px;font-size:0.82em;box-sizing:border-box">'
      + '</div>';
    html += '<div>'
      + '<div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Load-in window</div>'
      + '<input value="' + _spEsc(plot.loadIn || '') + '" onchange="_spUpdatePlotField(\'loadIn\',this.value)" placeholder="e.g. 4–5 PM" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:6px 10px;border-radius:6px;font-size:0.82em;box-sizing:border-box">'
      + '</div>';
    html += '</div>';

    // ── Backline list (what band brings vs venue provides) ──
    html += _spRenderBacklineList(plot);

    // ── Wireless frequency list ──
    html += _spRenderWirelessList(plot);

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

  // ── Cable routing overlay (SVG, absolutely positioned over the grid) ──
  // Lines drawn from each cable's fromEl center to its toEl center, color-
  // coded by type. Only computed when share=false OR cables exist; share
  // mode keeps cables visible so FOH sees the patch.
  if (plot.cables && plot.cables.length) {
    // Build element-id → grid-cell map for quick lookup
    var byId = {};
    plot.elements.forEach(function(ev, idx) {
      if (ev.id) byId[ev.id] = ev;
    });
    var cableSvg = '<svg style="position:absolute;inset:14px 10px 8px;width:calc(100% - 20px);height:calc(100% - 22px);pointer-events:none;overflow:visible" preserveAspectRatio="none" viewBox="0 0 ' + cols + ' ' + rows + '">';
    plot.cables.forEach(function(cable) {
      var f = byId[cable.fromId], t = byId[cable.toId];
      if (!f || !t) return;
      var cfg = SP_CABLE_TYPES[cable.type] || SP_CABLE_TYPES.other;
      // Cell centers in grid units (each cell is 1×1 in viewBox)
      var x1 = f.x + 0.5, y1 = f.y + 0.5;
      var x2 = t.x + 0.5, y2 = t.y + 0.5;
      cableSvg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" '
        + 'stroke="' + cfg.color + '" stroke-width="0.07" stroke-dasharray="0.2 0.15" stroke-linecap="round" opacity="0.85"/>';
      // Label at midpoint with type + length
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var label = cfg.label + (cable.length ? ' ' + cable.length + '\'' : '');
      cableSvg += '<text x="' + mx + '" y="' + my + '" font-size="0.18" fill="' + cfg.color + '" text-anchor="middle" font-weight="700" style="paint-order:stroke;stroke:rgba(15,23,42,0.85);stroke-width:0.05">' + label + '</text>';
    });
    cableSvg += '</svg>';
    html += cableSvg;
  }

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
  html += '<button onclick="_spShowSoundcheckOrder()" title="Suggest a soundcheck order following standard FOH practice" style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.25);color:#c4b5fd;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em;font-weight:700">Soundcheck order</button>';
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

function _spRenderCableSummary(plot) {
  var hasCables = plot.cables && plot.cables.length;
  var html = '<div style="margin-top:20px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Cable Runs</span>';
  html += '<span style="font-size:0.62em;color:var(--text-dim)">Click any element on the stage → "Connect cable from here" to start a run.</span>';
  html += '</div>';
  if (!hasCables) {
    html += '<div style="color:var(--text-dim);font-size:0.78em;padding:6px 0">No cable runs yet. Optional — only useful if you need a cable budget.</div>';
  } else {
    var byType = _spCableLengthSummary(plot);
    var totalLen = 0, totalCount = 0;
    Object.keys(byType).forEach(function(t) { totalLen += byType[t].length; totalCount += byType[t].count; });
    // Per-type summary line
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">';
    Object.keys(byType).forEach(function(t) {
      var cfg = SP_CABLE_TYPES[t] || SP_CABLE_TYPES.other;
      html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:0.72em">'
        + '<span style="display:inline-block;width:10px;height:3px;background:' + cfg.color + ';border-radius:1px"></span>'
        + '<span style="font-weight:700;color:' + cfg.color + '">' + cfg.label + '</span>'
        + '<span style="color:var(--text-muted)">×' + byType[t].count + (byType[t].length ? ' · ' + byType[t].length + '\'' : '') + '</span>'
        + '</span>';
    });
    html += '<span style="margin-left:auto;font-size:0.72em;color:var(--text-dim);font-weight:600">Total ' + totalCount + ' runs · ' + totalLen + '\'</span>';
    html += '</div>';
    // Per-cable rows for management
    plot.cables.forEach(function(c) {
      var fromEl = (plot.elements || []).find(function(e) { return e.id === c.fromId; });
      var toEl = (plot.elements || []).find(function(e) { return e.id === c.toId; });
      if (!fromEl || !toEl) return;
      var cfg = SP_CABLE_TYPES[c.type] || SP_CABLE_TYPES.other;
      html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.74em">'
        + '<span style="color:' + cfg.color + ';font-weight:700;min-width:46px">' + cfg.label + '</span>'
        + '<span style="color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis">' + _spEsc(fromEl.label) + ' → ' + _spEsc(toEl.label) + '</span>'
        + '<span style="color:var(--text-dim);min-width:36px;text-align:right">' + (c.length ? c.length + '\'' : '—') + '</span>'
        + '<button onclick="_spRemoveCable(\'' + c.id + '\')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.85em">✕</button>'
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

function _spRenderBacklineList(plot) {
  var hasItems = plot.backline && plot.backline.length;
  var html = '<div style="margin-top:20px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Backline</span>';
  html += '<button onclick="_spAddBacklineItem()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add item</button>';
  html += '</div>';
  if (!hasItems) {
    html += '<div style="color:var(--text-dim);font-size:0.78em;padding:6px 0">List the gear that needs to be on stage. Mark whether the band brings it (B) or the venue provides (V).</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:1fr 60px 22px;gap:6px;padding:4px 0;font-size:0.62em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">'
      + '<span>Item</span><span style="text-align:center">By</span><span></span></div>';
    plot.backline.forEach(function(item, i) {
      html += '<div style="display:grid;grid-template-columns:1fr 60px 22px;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
        + '<input value="' + _spEsc(item.label || '') + '" onchange="_spUpdateBacklineItem(' + i + ',\'label\',this.value)" placeholder="e.g. Kick drum, snare, 4-piece kit" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.78em">'
        + '<select onchange="_spUpdateBacklineItem(' + i + ',\'by\',this.value)" class="sp-select" style="font-size:0.72em;padding:4px 6px">'
        + '<option value="band"' + (item.by === 'band' ? ' selected' : '') + '>Band</option>'
        + '<option value="venue"' + (item.by === 'venue' ? ' selected' : '') + '>Venue</option>'
        + '<option value="rental"' + (item.by === 'rental' ? ' selected' : '') + '>Rental</option>'
        + '</select>'
        + '<button onclick="_spRemoveBacklineItem(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em">✕</button>'
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

function _spRenderWirelessList(plot) {
  var hasItems = plot.wireless && plot.wireless.length;
  var html = '<div style="margin-top:20px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">Wireless Frequencies</span>';
  html += '<button onclick="_spAddWirelessItem()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.68em">+ Add freq</button>';
  html += '</div>';
  if (!hasItems) {
    html += '<div style="color:var(--text-dim);font-size:0.78em;padding:6px 0">Optional — list IEM packs and wireless mic frequencies so FOH can avoid conflicts with house systems.</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:80px 1fr 100px 22px;gap:6px;padding:4px 0;font-size:0.62em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">'
      + '<span>Channel</span><span>Use / Member</span><span style="text-align:right">Frequency</span><span></span></div>';
    plot.wireless.forEach(function(item, i) {
      html += '<div style="display:grid;grid-template-columns:80px 1fr 100px 22px;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center">'
        + '<input value="' + _spEsc(item.channel || '') + '" onchange="_spUpdateWirelessItem(' + i + ',\'channel\',this.value)" placeholder="ch / pack" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 6px;border-radius:4px;font-size:0.74em">'
        + '<input value="' + _spEsc(item.use || '') + '" onchange="_spUpdateWirelessItem(' + i + ',\'use\',this.value)" placeholder="e.g. Lead vocal — Brian" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 8px;border-radius:4px;font-size:0.78em">'
        + '<input value="' + _spEsc(item.freq || '') + '" onchange="_spUpdateWirelessItem(' + i + ',\'freq\',this.value)" placeholder="e.g. 539.250 MHz" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:4px 6px;border-radius:4px;font-size:0.74em;text-align:right">'
        + '<button onclick="_spRemoveWirelessItem(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em">✕</button>'
        + '</div>';
    });
  }
  html += '</div>';
  return html;
}

function _spUpdatePlotField(field, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot[field] = val;
  _spDirty = true;
}
function _spAddBacklineItem() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.backline) plot.backline = [];
  plot.backline.push({ label: '', by: 'band' });
  _spDirty = true;
  _spRender();
}
function _spUpdateBacklineItem(idx, field, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.backline || !plot.backline[idx]) return;
  plot.backline[idx][field] = val;
  _spDirty = true;
}
function _spRemoveBacklineItem(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.backline) return;
  plot.backline.splice(idx, 1);
  _spDirty = true;
  _spRender();
}
function _spAddWirelessItem() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (!plot.wireless) plot.wireless = [];
  plot.wireless.push({ channel: '', use: '', freq: '' });
  _spDirty = true;
  _spRender();
}
function _spUpdateWirelessItem(idx, field, val) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.wireless || !plot.wireless[idx]) return;
  plot.wireless[idx][field] = val;
  _spDirty = true;
}
function _spRemoveWirelessItem(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.wireless) return;
  plot.wireless.splice(idx, 1);
  _spDirty = true;
  _spRender();
}

// Soundcheck order suggester — classifies each channel by family, then sorts
// in standard FOH order: drums first (kick→snare→toms→OH→hi-hat), then bass,
// then guitars, keys, aux instruments, BGVs, lead vox, and click/talkback
// last. Recipe matches what most monitor engineers do at line-check.
function _spClassifyChannel(ch) {
  var label = ((ch.label || '') + ' ' + (ch.mic || '')).toLowerCase();
  // Order of these checks matters: more specific patterns first.
  if (/click|metronome|talkback/.test(label)) return { fam: 'click', rank: 90 };
  if (/lead vocal|lead vox|vocal\s*1|vocal lead|main vocal/.test(label)) return { fam: 'leadVox', rank: 80 };
  if (/vocal|vox|sm58|beta\s*58|ksm/.test(label)) return { fam: 'bgv', rank: 70 };
  if (/kick|d6|beta 91|beta 52/.test(label)) return { fam: 'kick', rank: 10 };
  if (/snare|sm57.*snare|i5.*snare/.test(label)) return { fam: 'snare', rank: 12 };
  if (/tom|e604|e904/.test(label)) return { fam: 'tom', rank: 14 };
  if (/overhead|oh\b|c414|c451|km184/.test(label)) return { fam: 'oh', rank: 16 };
  if (/hi-?hat|hat|sm81/.test(label)) return { fam: 'hh', rank: 18 };
  if (/ride|crash|cymbal/.test(label)) return { fam: 'cymbal', rank: 19 };
  if (/drum/.test(label)) return { fam: 'drum', rank: 20 };
  if (/bass|di\s*bass|sansamp|bass\s*amp/.test(label)) return { fam: 'bass', rank: 30 };
  if (/electric guitar|gtr|guitar amp|cab|sm57.*amp|md421.*amp/.test(label)) return { fam: 'gtr', rank: 40 };
  if (/acoustic|martin|taylor|ac gtr|ac. gtr/.test(label)) return { fam: 'acoustic', rank: 50 };
  if (/keys|piano|rhodes|hammond|synth|nord|moog/.test(label)) return { fam: 'keys', rank: 55 };
  if (/sax|horn|trumpet|trombone|brass/.test(label)) return { fam: 'horn', rank: 60 };
  if (/perc|conga|shaker|tamb/.test(label)) return { fam: 'perc', rank: 25 };
  if (/di\b/.test(label)) return { fam: 'di', rank: 45 };
  return { fam: 'other', rank: 75 };
}

var SP_FAM_LABELS = {
  kick: 'Kick', snare: 'Snare', tom: 'Toms', oh: 'Overheads', hh: 'Hi-Hat',
  cymbal: 'Cymbals', drum: 'Other drums', perc: 'Percussion',
  bass: 'Bass', gtr: 'Electric guitar', acoustic: 'Acoustic instruments',
  di: 'DI inputs', keys: 'Keys / synth', horn: 'Horns',
  bgv: 'Backing vocals', leadVox: 'Lead vocal', click: 'Click / talkback',
  other: 'Other'
};

function _spShowSoundcheckOrder() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.channels || !plot.channels.length) {
    if (typeof showToast === 'function') showToast('Add some inputs first — soundcheck order pulls from the input list.');
    return;
  }
  // Tag every channel with its family + rank, then sort stable.
  var tagged = plot.channels.map(function(ch, i) {
    var c = _spClassifyChannel(ch);
    return { idx: i, ch: ch, fam: c.fam, rank: c.rank };
  });
  tagged.sort(function(a, b) { return a.rank - b.rank || a.idx - b.idx; });

  // Group by family for display.
  var groups = [];
  var currentFam = null;
  tagged.forEach(function(item) {
    if (item.fam !== currentFam) {
      groups.push({ fam: item.fam, items: [] });
      currentFam = item.fam;
    }
    groups[groups.length - 1].items.push(item);
  });

  // Build modal HTML
  var rows = '';
  var step = 1;
  groups.forEach(function(g) {
    rows += '<div style="margin-top:14px"><div style="font-size:0.7em;font-weight:700;color:#c4b5fd;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">' + (SP_FAM_LABELS[g.fam] || g.fam) + '</div>';
    g.items.forEach(function(item) {
      rows += '<div style="display:grid;grid-template-columns:32px 1fr 1fr;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.84em">'
        + '<span style="color:#a5b4fc;font-weight:700;text-align:right">' + step + '.</span>'
        + '<span style="color:var(--text)">' + _spEsc(item.ch.label || '—') + '</span>'
        + '<span style="color:var(--text-dim);font-size:0.85em">' + _spEsc(item.ch.mic || '') + '</span>'
        + '</div>';
      step++;
    });
    rows += '</div>';
  });

  var modal = document.createElement('div');
  modal.id = 'spSoundcheckModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:14px';
  modal.innerHTML = '<div style="background:var(--bg-card,#0f172a);border:1px solid rgba(168,85,247,0.25);border-radius:12px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<h3 style="margin:0;font-size:1.1em;color:#c4b5fd">🎚 Suggested Soundcheck Order</h3>'
    + '<button onclick="document.getElementById(\'spSoundcheckModal\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4em;cursor:pointer">×</button>'
    + '</div>'
    + '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:6px;line-height:1.5">Standard FOH practice — line-check drums first (loudest fixes affect everyone), then rhythm section, then top of mix. Hand this to your engineer at load-in.</div>'
    + rows
    + '<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">'
    + '<button onclick="_spCopySoundcheckOrder()" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:7px 14px;border-radius:6px;cursor:pointer;font-size:0.85em;font-weight:700">Copy as text</button>'
    + '<button onclick="document.getElementById(\'spSoundcheckModal\').remove()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:7px 14px;border-radius:6px;cursor:pointer;font-size:0.85em">Close</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);

  // Stash plain-text version for the Copy button.
  var lines = ['Soundcheck order — ' + (plot.name || 'Stage plot')];
  var n = 1;
  groups.forEach(function(g) {
    lines.push('');
    lines.push('— ' + (SP_FAM_LABELS[g.fam] || g.fam) + ' —');
    g.items.forEach(function(item) {
      lines.push(n + '. ' + (item.ch.label || '—') + (item.ch.mic ? ' (' + item.ch.mic + ')' : ''));
      n++;
    });
  });
  window._spSoundcheckText = lines.join('\n');
}

function _spCopySoundcheckOrder() {
  var txt = window._spSoundcheckText || '';
  if (!txt) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      if (typeof showToast === 'function') showToast('✓ Soundcheck order copied');
    });
  } else {
    prompt('Copy this:', txt);
  }
}

window._spShowSoundcheckOrder = _spShowSoundcheckOrder;
window._spCopySoundcheckOrder = _spCopySoundcheckOrder;

window._spUpdatePlotField = _spUpdatePlotField;
window._spAddBacklineItem = _spAddBacklineItem;
window._spUpdateBacklineItem = _spUpdateBacklineItem;
window._spRemoveBacklineItem = _spRemoveBacklineItem;
window._spAddWirelessItem = _spAddWirelessItem;
window._spUpdateWirelessItem = _spUpdateWirelessItem;
window._spRemoveWirelessItem = _spRemoveWirelessItem;

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

// Cable routing — connects two placed elements with an annotated line
// (mic cable, DI line, power, etc.). Stored on plot as plot.cables[].
// Visualized as an SVG overlay on top of the grid. Each cable has:
//   { id, fromId, toId, type, length, label, color }
var SP_CABLE_TYPES = {
  'mic-cable': { color: '#fbbf24', label: 'XLR' },
  'instrument': { color: '#f87171', label: 'Inst' },
  'di-line':   { color: '#86efac', label: 'DI' },
  'power':     { color: '#a5b4fc', label: 'AC' },
  'iem':       { color: '#fb923c', label: 'IEM' },
  'speaker':   { color: '#94a3b8', label: 'Spkr' },
  'mon-send':  { color: '#34d399', label: 'Mon' },
  'other':     { color: '#cbd5e1', label: '—' }
};

var _spCableFromIdx = -1; // when in "draw cable" mode, this is the source element

function _spStartCableFrom(idx) {
  _spCableFromIdx = idx;
  if (typeof showToast === 'function') showToast('Pick another element to connect to (or click the same element to cancel)');
  _spRender();
}

function _spCableConnect(toIdx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) { _spCableFromIdx = -1; return; }
  if (_spCableFromIdx === toIdx) { _spCableFromIdx = -1; _spRender(); return; }
  var fromEl = plot.elements[_spCableFromIdx];
  var toEl = plot.elements[toIdx];
  if (!fromEl || !toEl) { _spCableFromIdx = -1; _spRender(); return; }
  // Ensure both have IDs (legacy elements may not)
  if (!fromEl.id) fromEl.id = 'el_' + Date.now() + '_a';
  if (!toEl.id) toEl.id = 'el_' + Date.now() + '_b';
  // Pick cable type
  var type = prompt(
    'Cable type:\n1 = XLR (mic cable)\n2 = Instrument\n3 = DI line\n4 = Power (AC)\n5 = IEM\n6 = Speaker\n7 = Monitor send\n8 = Other',
    '1'
  );
  var typeMap = { '1':'mic-cable', '2':'instrument', '3':'di-line', '4':'power', '5':'iem', '6':'speaker', '7':'mon-send', '8':'other' };
  var cableType = typeMap[type] || 'other';
  var lengthStr = prompt('Length (ft, optional):', '25');
  var length = parseFloat(lengthStr) || 0;
  if (!plot.cables) plot.cables = [];
  plot.cables.push({
    id: 'cable_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    fromId: fromEl.id,
    toId: toEl.id,
    type: cableType,
    length: length
  });
  _spCableFromIdx = -1;
  _spDirty = true;
  _spRender();
}

function _spRemoveCable(cableId) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.cables) return;
  plot.cables = plot.cables.filter(function(c) { return c.id !== cableId; });
  _spDirty = true;
  _spRender();
}

function _spCableLengthSummary(plot) {
  if (!plot.cables || !plot.cables.length) return null;
  var byType = {};
  plot.cables.forEach(function(c) {
    if (!byType[c.type]) byType[c.type] = { count: 0, length: 0 };
    byType[c.type].count++;
    byType[c.type].length += (c.length || 0);
  });
  return byType;
}

window._spStartCableFrom = _spStartCableFrom;
window._spCableConnect = _spCableConnect;
window._spRemoveCable = _spRemoveCable;

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

  // If a cable is being drawn, this click is the destination
  if (_spCableFromIdx >= 0) { _spCableConnect(idx); return; }
  // If already in move mode for this element, cancel
  if (_spMoveIdx === idx) { _spMoveIdx = -1; _spRender(); return; }

  var action = prompt(
    el.label + '\n\nChoose action:\n1 = Edit label\n2 = Move\n3 = Rotate\n4 = Set input #\n5 = Connect cable from here\n6 = Cancel',
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
  } else if (action === '5') {
    _spStartCableFrom(idx);
  }
}

function _spSetPlacementMode(mode) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (mode === 'free' && (plot.placementMode || 'grid') === 'grid') {
    // Convert existing grid coords → % so elements appear in similar
    // positions when entering free mode for the first time.
    var cols = Math.min(10, Math.max(6, (plot.elements || []).length + 2));
    var rows = 5;
    (plot.elements || []).forEach(function(el) {
      if (el.xPct === undefined) el.xPct = (el.x + 0.5) / cols * 100;
      if (el.yPct === undefined) el.yPct = (el.y + 0.5) / rows * 100;
    });
  }
  plot.placementMode = mode;
  _spDirty = true;
  _spRender();
}
window._spSetPlacementMode = _spSetPlacementMode;

// Free-form render: absolute-positioned elements on a fixed-aspect canvas.
// Elements use xPct/yPct (% of canvas dimensions). Drag updates these
// percentages so the layout scales gracefully across screen sizes.
function _spRenderStageFree(plot) {
  var share = _spShareMode;
  var canvasH = share ? '260px' : '320px';
  var html = '<div id="spFreeCanvas" class="' + (share ? 'sp-share' : '') + '"'
    + ' ondragover="_spFreeDragOver(event)"'
    + ' ondrop="_spFreeDrop(event)"'
    + ' onclick="_spFreeCanvasClick(event)"'
    + ' style="position:relative;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px 10px 8px;height:' + canvasH + ';overflow:hidden">';
  html += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--bg,#1e293b);padding:0 8px;font-size:0.58em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">STAGE' + (share ? '' : ' — ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\'') + '</div>';
  if (_spShowDirections && !share) {
    html += '<div style="position:absolute;top:50%;left:-2px;transform:translateY(-50%) rotate(-90deg);font-size:0.45em;font-weight:700;color:rgba(255,255,255,0.06);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap">SL</div>';
    html += '<div style="position:absolute;top:50%;right:-2px;transform:translateY(-50%) rotate(90deg);font-size:0.45em;font-weight:700;color:rgba(255,255,255,0.06);letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap">SR</div>';
  }

  // Elements
  (plot.elements || []).forEach(function(el, idx) {
    var xPct = el.xPct !== undefined ? el.xPct : (el.x + 0.5) / 10 * 100;
    var yPct = el.yPct !== undefined ? el.yPct : (el.y + 0.5) / 5 * 100;
    var baseLabel = (el.label || '').split(' – ')[0].trim();
    var sc = SP_SIZE_CLASS[baseLabel] || 'sm';
    var w = sc === 'lg' ? 84 : sc === 'md' ? 64 : 50;
    var iconSize = share ? '0.85em' : '1em';
    var bg = sc === 'lg' ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)';
    var border = sc === 'lg' ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.18)';
    var displayLabel = share && el.label.indexOf(' – ') >= 0 ? el.label.split(' – ')[0].split(' ')[0] : (SP_COMPACT[baseLabel] || baseLabel);
    var rot = el.rotation || 0;
    html += '<div data-el-idx="' + idx + '"'
      + (share ? '' : ' draggable="true"'
        + ' ondragstart="_spDragStart(event,' + idx + ')"'
        + ' ondragend="_spDragEnd(event)"'
        + ' onclick="event.stopPropagation();_spClickElement(' + idx + ')"')
      + ' style="position:absolute;left:' + xPct + '%;top:' + yPct + '%;transform:translate(-50%,-50%) rotate(' + rot + 'deg);width:' + w + 'px;background:' + bg + ';border:1px solid ' + border + ';border-radius:6px;padding:4px;text-align:center;cursor:' + (share ? 'default' : 'grab') + ';font-size:' + iconSize + ';line-height:1.2;user-select:none">';
    html += '<div style="font-size:1em">' + el.icon + '</div>';
    if (_spShowLabels || share) {
      html += '<div style="font-size:0.5em;font-weight:600;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _spEsc(displayLabel) + '</div>';
    }
    if (!share) {
      html += '<button class="sp-del" onclick="event.stopPropagation();_spRemoveElement(' + idx + ')" style="position:absolute;top:-2px;right:-2px;background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.15);border-radius:50%;color:#94a3b8;cursor:pointer;font-size:0.6em;padding:0;width:14px;height:14px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s">✕</button>';
    }
    html += '</div>';
  });

  // Cable overlay (SVG)
  if (plot.cables && plot.cables.length) {
    var byId = {};
    plot.elements.forEach(function(ev) { if (ev.id) byId[ev.id] = ev; });
    html += '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" preserveAspectRatio="none" viewBox="0 0 100 100">';
    plot.cables.forEach(function(c) {
      var f = byId[c.fromId], t = byId[c.toId];
      if (!f || !t) return;
      var fx = f.xPct !== undefined ? f.xPct : (f.x + 0.5) / 10 * 100;
      var fy = f.yPct !== undefined ? f.yPct : (f.y + 0.5) / 5 * 100;
      var tx = t.xPct !== undefined ? t.xPct : (t.x + 0.5) / 10 * 100;
      var ty = t.yPct !== undefined ? t.yPct : (t.y + 0.5) / 5 * 100;
      var cfg = SP_CABLE_TYPES[c.type] || SP_CABLE_TYPES.other;
      html += '<line x1="' + fx + '" y1="' + fy + '" x2="' + tx + '" y2="' + ty + '" stroke="' + cfg.color + '" stroke-width="0.4" stroke-dasharray="1.2 0.9" stroke-linecap="round" opacity="0.85" vector-effect="non-scaling-stroke"/>';
    });
    html += '</svg>';
  }

  // Audience marker
  html += '<div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:0.52em;font-weight:700;color:rgba(255,255,255,0.18);letter-spacing:0.15em;text-transform:uppercase">▼ AUDIENCE ▼</div>';
  html += '</div>';
  return html;
}

// Free-mode drag handlers
function _spFreeDragOver(ev) { ev.preventDefault(); }
function _spFreeDrop(ev) {
  ev.preventDefault();
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var canvas = document.getElementById('spFreeCanvas');
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var xPct = ((ev.clientX - rect.left) / rect.width) * 100;
  var yPct = ((ev.clientY - rect.top) / rect.height) * 100;
  // Clamp
  xPct = Math.max(2, Math.min(98, xPct));
  yPct = Math.max(4, Math.min(96, yPct));
  var idx = _spDragIdx;
  if (idx < 0) {
    var d = ev.dataTransfer && ev.dataTransfer.getData ? ev.dataTransfer.getData('text/plain') : '';
    idx = parseInt(d, 10);
  }
  if (isNaN(idx) || idx < 0 || !plot.elements[idx]) return;
  plot.elements[idx].xPct = xPct;
  plot.elements[idx].yPct = yPct;
  _spDragIdx = -1;
  _spDirty = true;
  _spRender();
}
// Click empty canvas → place pending element at click coords
function _spFreeCanvasClick(ev) {
  if (!_spPendingElement) return;
  var canvas = document.getElementById('spFreeCanvas');
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var xPct = ((ev.clientX - rect.left) / rect.width) * 100;
  var yPct = ((ev.clientY - rect.top) / rect.height) * 100;
  xPct = Math.max(2, Math.min(98, xPct));
  yPct = Math.max(4, Math.min(96, yPct));
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  var newEl = {
    id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: _spPendingElement.type,
    icon: _spPendingElement.icon,
    label: _spPendingElement.label,
    x: 0, y: 0,
    xPct: xPct, yPct: yPct,
    rotation: 0
  };
  if (_spPendingElement.mic) newEl.mic = _spPendingElement.mic;
  plot.elements.push(newEl);
  _spPendingElement = null;
  _spDirty = true;
  _spRender();
}

window._spFreeDragOver = _spFreeDragOver;
window._spFreeDrop = _spFreeDrop;
window._spFreeCanvasClick = _spFreeCanvasClick;

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
  // QR code — points at the public live link so the user can flash their
  // phone at FOH or print the page. api.qrserver.com is keyless / free.
  if (plot.id) {
    var bandSlug = (typeof window.currentBandSlug !== 'undefined' && window.currentBandSlug)
      || (typeof localStorage !== 'undefined' && localStorage.getItem('deadcetera_band_slug'))
      || 'deadcetera';
    var pubUrl = 'https://share.groovelinx.com/stageplot/' + encodeURIComponent(bandSlug) + '/' + encodeURIComponent(plot.id);
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(pubUrl);
    html += '<div style="margin-top:12px;padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;background:rgba(255,255,255,0.02);display:flex;align-items:center;gap:10px">'
      + '<img src="' + qrSrc + '" alt="QR code" style="width:90px;height:90px;background:#fff;border-radius:4px;flex-shrink:0">'
      + '<div style="font-size:0.72em;color:var(--text-muted);line-height:1.4"><div style="font-weight:700;color:var(--text);margin-bottom:2px">Scan for the live link</div>Always reflects the latest stage plot. Hand your phone to the FOH engineer or screenshot to text.</div>'
      + '</div>';
  }
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
  // Setup time / load-in
  if (plot.setupTime || plot.loadIn) {
    html += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    if (plot.setupTime) html += '<div><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2px">Setup / Soundcheck</div><div style="font-size:0.72em;color:var(--text-muted)">' + _spEsc(plot.setupTime) + '</div></div>';
    if (plot.loadIn) html += '<div><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2px">Load-in</div><div style="font-size:0.72em;color:var(--text-muted)">' + _spEsc(plot.loadIn) + '</div></div>';
    html += '</div>';
  }
  // Backline
  if (plot.backline && plot.backline.length) {
    html += '<div style="margin-top:10px"><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Backline</div>';
    plot.backline.forEach(function(item) {
      if (!item.label) return;
      var byTag = item.by === 'venue' ? '<span style="color:#10b981">venue</span>' : (item.by === 'rental' ? '<span style="color:#f59e0b">rental</span>' : '<span style="color:#60a5fa">band</span>');
      html += '<div style="font-size:0.72em;color:var(--text-muted);padding:1px 0">• ' + _spEsc(item.label) + ' <span style="font-size:0.85em">(' + byTag + ')</span></div>';
    });
    html += '</div>';
  }
  // Wireless
  if (plot.wireless && plot.wireless.length) {
    html += '<div style="margin-top:10px"><div style="font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">Wireless Frequencies</div>';
    plot.wireless.forEach(function(item) {
      if (!item.use && !item.freq) return;
      html += '<div style="font-size:0.72em;color:var(--text-muted);padding:1px 0">' + _spEsc(item.channel || '—') + ' · ' + _spEsc(item.use || '') + (item.freq ? ' · <span style="color:var(--text-dim)">' + _spEsc(item.freq) + '</span>' : '') + '</div>';
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

// Generate a share link. Two flavors offered:
//   1. Public link (worker route /stageplot/...) — no GrooveLinx login
//      required, perfect for FOH engineers who don't have band accounts.
//   2. In-band link (#stageplot-share/...) — requires GrooveLinx login,
//      lands in the app's share mode with full editor access.
// Both always show the current Firebase state.
function _spCopyShareLink() {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (_spDirty) _spSave();

  var bandSlug = (typeof window.currentBandSlug !== 'undefined' && window.currentBandSlug)
    || (typeof localStorage !== 'undefined' && localStorage.getItem('deadcetera_band_slug'))
    || 'deadcetera';
  // Public share URL uses share.groovelinx.com — Cloudflare worker route
  // configured to map this hostname to the same worker that serves
  // /stageplot/:bandSlug/:plotId. The legacy *.workers.dev URL keeps
  // working as a fallback (same worker) — both routes serve the same
  // handler, so nothing breaks if DNS is mid-flight.
  var publicUrl = 'https://share.groovelinx.com/stageplot/'
    + encodeURIComponent(bandSlug) + '/' + encodeURIComponent(plot.id);
  var inBandUrl = window.location.origin + window.location.pathname
    + '#stageplot-share/' + encodeURIComponent(plot.id);

  var pick = prompt(
    'Pick a share link to copy:\n\n'
    + '1 = Public link (no GrooveLinx login required — best for FOH engineers / venue contacts)\n'
    + '2 = In-band link (GrooveLinx login required — best for the band)\n'
    + '3 = Cancel',
    '1'
  );
  if (pick !== '1' && pick !== '2') return;
  var url = pick === '1' ? publicUrl : inBandUrl;
  var label = pick === '1' ? 'Public link' : 'In-band link';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function() {
      if (typeof showToast === 'function') showToast('✓ ' + label + ' copied. Always shows the latest version.', 5000);
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

  // Page 3.5: Logistics (setup time, load-in, backline, wireless)
  var hasLogistics = plot.setupTime || plot.loadIn || (plot.backline && plot.backline.length) || (plot.wireless && plot.wireless.length);
  var pageLogistics = '';
  if (hasLogistics) {
    pageLogistics = '<section style="page-break-after:always">' + headerBar('Logistics');
    if (plot.setupTime || plot.loadIn) {
      pageLogistics += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';
      if (plot.setupTime) pageLogistics += '<div style="padding:10px;border:1px solid #ddd;border-radius:4px;background:#fff"><div style="font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Setup / Soundcheck</div><div style="font-size:13px;color:#222">' + _spEsc(plot.setupTime) + '</div></div>';
      if (plot.loadIn) pageLogistics += '<div style="padding:10px;border:1px solid #ddd;border-radius:4px;background:#fff"><div style="font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Load-in Window</div><div style="font-size:13px;color:#222">' + _spEsc(plot.loadIn) + '</div></div>';
      pageLogistics += '</div>';
    }
    if (plot.backline && plot.backline.length) {
      pageLogistics += '<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:700;color:' + brandColor + ';margin-bottom:6px">Backline</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:' + brandColor + ';color:#fff">'
        + '<th style="border:1px solid ' + brandColor + ';padding:5px 8px;text-align:left">Item</th>'
        + '<th style="border:1px solid ' + brandColor + ';padding:5px 8px;text-align:left;width:90px">Provided by</th>'
        + '</tr></thead><tbody>';
      plot.backline.forEach(function(item, i) {
        if (!item.label) return;
        var byTxt = item.by === 'venue' ? 'Venue' : (item.by === 'rental' ? 'Rental' : 'Band');
        pageLogistics += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '">'
          + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(item.label) + '</td>'
          + '<td style="border:1px solid #ddd;padding:5px 8px;font-weight:600">' + byTxt + '</td>'
          + '</tr>';
      });
      pageLogistics += '</tbody></table></div>';
    }
    if (plot.wireless && plot.wireless.length) {
      pageLogistics += '<div><div style="font-size:13px;font-weight:700;color:' + brandColor + ';margin-bottom:6px">Wireless Frequencies</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:' + brandColor + ';color:#fff">'
        + '<th style="border:1px solid ' + brandColor + ';padding:5px 8px;text-align:left;width:80px">Channel</th>'
        + '<th style="border:1px solid ' + brandColor + ';padding:5px 8px;text-align:left">Use / Member</th>'
        + '<th style="border:1px solid ' + brandColor + ';padding:5px 8px;text-align:right;width:120px">Frequency</th>'
        + '</tr></thead><tbody>';
      plot.wireless.forEach(function(item, i) {
        if (!item.use && !item.freq && !item.channel) return;
        pageLogistics += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '">'
          + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(item.channel || '') + '</td>'
          + '<td style="border:1px solid #ddd;padding:5px 8px">' + _spEsc(item.use || '') + '</td>'
          + '<td style="border:1px solid #ddd;padding:5px 8px;text-align:right;font-family:ui-monospace,monospace">' + _spEsc(item.freq || '') + '</td>'
          + '</tr>';
      });
      pageLogistics += '</tbody></table></div>';
    }
    pageLogistics += '</section>';
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
    + pageLogistics
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
