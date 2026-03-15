/**
 * js/features/stage-plot.js — Stage Plot Builder v1
 *
 * Grid-based stage layout with band member positions, gear icons,
 * channel list, and monitor mixes. Persists to Firebase.
 *
 * Phase 1: grid layout + data model + persistence
 * Phase 2: drag-and-drop canvas (future)
 * Phase 3: PDF export (future)
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
    { type: 'gear', icon: '🎹', label: 'Keyboard' },
    { type: 'gear', icon: '🎛️', label: 'Pedalboard' },
    { type: 'gear', icon: '💻', label: 'Laptop' },
  ],
  audio: [
    { type: 'audio', icon: '🎙️', label: 'Vocal Mic' },
    { type: 'audio', icon: '🎙️', label: 'Inst Mic' },
    { type: 'audio', icon: '📦', label: 'DI Box' },
    { type: 'audio', icon: '🔊', label: 'Monitor Wedge' },
    { type: 'audio', icon: '🎧', label: 'IEM Pack' },
    { type: 'audio', icon: '🔈', label: 'Side Fill' },
  ],
  stage: [
    { type: 'stage', icon: '⬜', label: 'Riser' },
    { type: 'stage', icon: '⬜', label: 'Drum Riser' },
    { type: 'stage', icon: '⚡', label: 'Power Drop' },
  ]
};

// ── Page Renderer ────────────────────────────────────────────────────────────

function renderStagePlotPage(el) {
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
  var elements = [];
  var col = 0;
  if (typeof bandMembers !== 'undefined') {
    Object.entries(bandMembers).forEach(function(e) {
      var key = e[0], m = e[1];
      var icon = m.role === 'Drums' ? '🥁' : m.role === 'Keyboard' ? '🎹' : m.role === 'Bass' ? '🎸' : '🎸';
      elements.push({ type: 'musician', icon: icon, label: m.name + ' – ' + m.role, x: col, y: 1 });
      col++;
    });
  }
  _spPlots = [{
    id: 'default',
    name: 'Default Setup',
    stageWidth: 24,
    stageDepth: 16,
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

  var html = '';

  // Plot selector + controls
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
  html += '<select id="spPlotSelect" onchange="_spSwitchPlot(this.value)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:var(--text);padding:6px 10px;border-radius:6px;font-size:0.85em">';
  _spPlots.forEach(function(p, i) {
    html += '<option value="' + i + '"' + (i === _spCurrentIdx ? ' selected' : '') + '>' + _spEsc(p.name) + '</option>';
  });
  html += '</select>';
  html += '<button onclick="_spAddPlot()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700">+ New Layout</button>';
  html += '<button onclick="_spSave()" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700;margin-left:auto">Save</button>';
  html += '</div>';

  // Stage canvas (grid-based)
  html += _spRenderStage(plot);

  // Element palette
  html += '<div style="margin-top:16px">';
  html += '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Add to Stage</div>';
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  Object.keys(SP_ELEMENTS).forEach(function(cat) {
    SP_ELEMENTS[cat].forEach(function(el) {
      html += '<button onclick="_spAddElement(\'' + el.type + '\',\'' + _spEsc(el.icon) + '\',\'' + _spEsc(el.label) + '\')" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.72em;display:flex;align-items:center;gap:4px"><span>' + el.icon + '</span><span>' + el.label + '</span></button>';
    });
  });
  html += '</div></div>';

  // Channel list
  html += _spRenderChannelList(plot);

  // Monitor mixes
  html += _spRenderMonitorMixes(plot);

  container.innerHTML = html;
}

function _spRenderStage(plot) {
  var cols = Math.min(8, Math.max(4, plot.elements.length + 1));
  var rows = 3; // front, middle, back

  var html = '<div style="position:relative;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;min-height:200px">';

  // Stage label
  html += '<div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#1e293b;padding:0 8px;font-size:0.62em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase">STAGE — ' + plot.stageWidth + '\' x ' + plot.stageDepth + '\'</div>';

  // Grid of placed elements
  html += '<div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:8px;min-height:160px">';
  // Create grid cells
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var el = plot.elements.find(function(e) { return e.x === c && e.y === r; });
      if (el) {
        var elIdx = plot.elements.indexOf(el);
        html += '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:8px 4px;text-align:center;min-height:50px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;position:relative" onclick="_spEditElement(' + elIdx + ')">';
        html += '<span style="font-size:1.2em">' + el.icon + '</span>';
        html += '<span style="font-size:0.6em;font-weight:600;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">' + _spEsc(el.label) + '</span>';
        html += '<button onclick="event.stopPropagation();_spRemoveElement(' + elIdx + ')" style="position:absolute;top:2px;right:2px;background:none;border:none;color:#64748b;cursor:pointer;font-size:0.6em;padding:2px">✕</button>';
        html += '</div>';
      } else {
        html += '<div style="background:rgba(255,255,255,0.01);border:1px dashed rgba(255,255,255,0.06);border-radius:8px;min-height:50px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="_spPlaceAtCell(' + c + ',' + r + ')"><span style="color:rgba(255,255,255,0.1);font-size:0.7em">+</span></div>';
      }
    }
  }
  html += '</div>';

  // Audience marker
  html += '<div style="text-align:center;margin-top:12px;font-size:0.6em;font-weight:700;color:rgba(255,255,255,0.15);letter-spacing:0.2em;text-transform:uppercase">&#x25BC; AUDIENCE &#x25BC;</div>';

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
  _spPendingElement = { type: type, icon: icon, label: label };
  if (typeof showToast === 'function') showToast('Tap an empty cell on the stage to place ' + label);
}

function _spPlaceAtCell(x, y) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  if (_spPendingElement) {
    plot.elements.push({ type: _spPendingElement.type, icon: _spPendingElement.icon, label: _spPendingElement.label, x: x, y: y });
    _spPendingElement = null;
    _spDirty = true;
    _spRender();
  }
}

function _spRemoveElement(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot) return;
  plot.elements.splice(idx, 1);
  _spDirty = true;
  _spRender();
}

function _spEditElement(idx) {
  var plot = _spPlots[_spCurrentIdx];
  if (!plot || !plot.elements[idx]) return;
  var el = plot.elements[idx];
  var newLabel = prompt('Edit label:', el.label);
  if (newLabel !== null) {
    el.label = newLabel;
    _spDirty = true;
    _spRender();
  }
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
window._spEditElement = _spEditElement;
window._spAddChannel = _spAddChannel;
window._spUpdateChannel = _spUpdateChannel;
window._spRemoveChannel = _spRemoveChannel;
window._spAddMonitor = _spAddMonitor;
window._spUpdateMonitor = _spUpdateMonitor;
window._spRemoveMonitor = _spRemoveMonitor;
window._spAddPlot = _spAddPlot;
window._spSwitchPlot = _spSwitchPlot;
window._spSave = _spSave;

console.log('🎭 stage-plot.js loaded');
