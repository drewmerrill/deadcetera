// ============================================================================
// js/features/harmony-lab.js
// GrooveLinx Harmony Lab — Sing Tab MVP
//
// Three modes: Learn · Practice · Record
//
// PHASE 4 STUBS (not yet wired):
//   - abcjs notation rendering (placeholder div)
//   - WebAudio mixer (controls are visual only)
//   - Firebase Storage upload (saves blob URL + pending flag)
//   - harmonyProfiles / harmonyParts collections (reads existing harmony data)
//
// CURRENT DATA SOURCES:
//   - Song title / key / BPM from selectedSong + existing DOM selects
//   - Parts / sections from loadBandDataFromDrive(songTitle, 'harmonies_data')
//   - My takes from loadHarmonyAudioSnippets() — existing function
//   - Assigned singers from harmonyMembersRow checkboxes
//
// EXPOSES:
//   renderHarmonyLab(songTitle, mountId)
//   hlSwitchMode(mode)
//   hlHeadphoneGate()
//   hlStartRecording()
//   hlStopRecording()
//   hlSaveRecording(visibility)
// ============================================================================

'use strict';

// ── Module state ──────────────────────────────────────────────────────────────
var _hlSong          = null;
var _hlMountId       = null;
var _hlMode          = 'learn';  // learn | practice | record
var _hlMediaRecorder = null;
var _hlChunks        = [];
var _hlBlobUrl       = null;
var _hlRecordingEl   = null;
var _hlMixerState    = { mixer: 'full', tempo: 100, transpose: 0, loopEnabled: false };
var _hlSections      = [];
var _hlActiveSection = null;

// ── Public API ────────────────────────────────────────────────────────────────

window.renderHarmonyLab = function renderHarmonyLab(songTitle, mountId) {
  _hlSong    = songTitle;
  _hlMountId = mountId || 'sd-harmony-lab-mount';
  _hlMode    = 'learn';

  var mount = document.getElementById(_hlMountId);
  if (!mount) return;

  mount.innerHTML = _hlShellHTML(songTitle);
  _hlInjectStyles();
  _hlLoadData(songTitle);
};

window.hlSwitchMode = function hlSwitchMode(mode) {
  if (!['learn','practice','record'].includes(mode)) return;
  _hlMode = mode;

  document.querySelectorAll('.hl-mode-btn').forEach(function(btn) {
    btn.classList.toggle('hl-mode-btn--active', btn.dataset.mode === mode);
  });
  document.querySelectorAll('.hl-mode-panel').forEach(function(panel) {
    var active = panel.dataset.mode === mode;
    panel.style.display = active ? 'block' : 'none';
  });

  if (mode === 'record') _hlCheckHeadphones();
};

window.hlHeadphoneGate = function hlHeadphoneGate() {
  var gate = document.getElementById('hl-headphone-gate');
  if (gate) gate.remove();
  document.getElementById('hl-recorder-ready')?.classList.remove('hl-hidden');
};

window.hlStartRecording = async function hlStartRecording() {
  var btn = document.getElementById('hl-rec-btn');
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _hlChunks = [];
    _hlMediaRecorder = new MediaRecorder(stream);
    _hlMediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) _hlChunks.push(e.data); };
    _hlMediaRecorder.onstop = _hlOnRecordingStop;
    _hlMediaRecorder.start(100);

    if (btn) {
      btn.textContent = '⏹ Stop';
      btn.onclick = window.hlStopRecording;
      btn.style.background = '#ef4444';
    }
    _hlStartWaveformAnimation();
    _hlStartTimer();
  } catch(e) {
    if (typeof showToast === 'function') showToast('Microphone access denied');
  }
};

window.hlStopRecording = function hlStopRecording() {
  if (_hlMediaRecorder && _hlMediaRecorder.state !== 'inactive') {
    _hlMediaRecorder.stop();
    _hlMediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
  }
  _hlStopTimer();
  _hlStopWaveformAnimation();
};

window.hlSaveRecording = async function hlSaveRecording(visibility) {
  if (!_hlBlobUrl) { if (typeof showToast === 'function') showToast('No recording to save'); return; }
  if (!requireSignIn || !requireSignIn()) return;

  var songTitle = _hlSong;
  var memberKey = typeof getCurrentMemberReadinessKey === 'function' ? getCurrentMemberReadinessKey() : 'unknown';

  // Phase 6: upload blob to Firebase Storage and get a permanent URL.
  // For now: store the blob URL + pending flag.
  var record = {
    songId:          sanitizeFirebasePath ? sanitizeFirebasePath(songTitle) : songTitle,
    userId:          memberKey,
    audioUrl:        _hlBlobUrl,
    uploadStatus:    'pending',   // → 'uploaded' after Firebase Storage wired
    duration:        _hlGetRecordingDuration(),
    visibility:      visibility,  // private | band | reference
    createdAt:       new Date().toISOString(),
    votes:           0,
    isReferenceTake: visibility === 'reference',
  };

  try {
    var path = bandPath
      ? bandPath('harmonyRecordings/' + sanitizeFirebasePath(songTitle) + '/' + memberKey + '_' + Date.now())
      : 'harmonyRecordings/' + songTitle + '/' + memberKey;
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.ref(path).set(record);
    }
    if (typeof showToast === 'function') showToast('Take saved (' + visibility + ')');
    _hlRefreshMyTakes(songTitle);
    document.getElementById('hl-save-panel')?.classList.add('hl-hidden');
  } catch(err) {
    if (typeof showToast === 'function') showToast('Save failed: ' + err.message);
  }
};

// ── Shell HTML ────────────────────────────────────────────────────────────────

function _hlShellHTML(title) {
  var key = _hlGetSongKey();
  var bpm = _hlGetSongBpm();

  return [
    '<div class="hl-root">',

    // Header
    '<div class="hl-header">',
    '  <div class="hl-header-left">',
    '    <div class="hl-header-song">' + _hlEsc(title) + '</div>',
    '    <div class="hl-header-meta">',
    key ? '<span class="hl-meta-badge">🔑 ' + _hlEsc(key) + '</span>' : '',
    bpm ? '<span class="hl-meta-badge">🥁 ' + _hlEsc(String(bpm)) + ' BPM</span>' : '',
    '    </div>',
    '  </div>',
    '  <div class="hl-mode-switcher">',
    '    <button class="hl-mode-btn hl-mode-btn--active" data-mode="learn"    onclick="hlSwitchMode(\'learn\')">📖 Learn</button>',
    '    <button class="hl-mode-btn"                     data-mode="practice" onclick="hlSwitchMode(\'practice\')">🎛️ Practice</button>',
    '    <button class="hl-mode-btn"                     data-mode="record"   onclick="hlSwitchMode(\'record\')">⏺️ Record</button>',
    '  </div>',
    '</div>',

    // Body: left rail + main content + right panel
    '<div class="hl-body">',

    // Left rail — sections
    '<div class="hl-left-rail">',
    '  <div class="hl-rail-title">Sections</div>',
    '  <div id="hl-sections-list" class="hl-sections-list">',
    '    <div class="hl-rail-empty">Loading…</div>',
    '  </div>',
    '</div>',

    // Center
    '<div class="hl-center">',

    // ── Learn mode ──
    '<div class="hl-mode-panel" data-mode="learn">',
    '  <div class="hl-parts-grid" id="hl-parts-grid">',
    '    <div class="hl-loading">Loading harmony parts…</div>',
    '  </div>',
    '  <div class="hl-notation-area">',
    '    <div class="hl-notation-label">Notation</div>',
    '    <div id="hl-abc-container" class="hl-abc-placeholder">',
    '      <div class="hl-abc-icon">𝄞</div>',
    '      <div class="hl-abc-msg">ABC notation will appear here once abcjs is loaded (Phase 4)</div>',
    '    </div>',
    '  </div>',
    '</div>',

    // ── Practice mode ──
    '<div class="hl-mode-panel" data-mode="practice" style="display:none">',
    '  <div class="hl-mixer">',
    '    <div class="hl-mixer-title">Mix Controls</div>',
    '    <div class="hl-mixer-row">',
    '      <button class="hl-mix-btn hl-mix-btn--active" id="hlMixFull"    onclick="hlSetMixer(\'full\')"   >🎶 Full Mix</button>',
    '      <button class="hl-mix-btn"                    id="hlMixSolo"    onclick="hlSetMixer(\'solo\')"   >🎤 Solo My Part</button>',
    '      <button class="hl-mix-btn"                    id="hlMixMute"    onclick="hlSetMixer(\'mute\')"   >🔇 Mute My Part</button>',
    '      <button class="hl-mix-btn"                    id="hlMixBacking" onclick="hlSetMixer(\'backing\')">🥁 Backing Only</button>',
    '    </div>',
    '    <div class="hl-slider-row">',
    '      <label class="hl-slider-label">Tempo <span id="hlTempoVal">100%</span></label>',
    '      <input type="range" class="hl-slider" min="50" max="120" value="100" id="hlTempoSlider" oninput="hlTempoChange(this.value)">',
    '      <span id="hlTempoBpm" class="hl-slider-hint">' + (bpm ? bpm + ' BPM' : '— BPM') + '</span>',
    '    </div>',
    '    <div class="hl-slider-row">',
    '      <label class="hl-slider-label">Transpose <span id="hlTransposeVal">0</span></label>',
    '      <input type="range" class="hl-slider" min="-6" max="6" value="0" id="hlTransposeSlider" oninput="hlTransposeChange(this.value)">',
    '      <span id="hlTransposeKey" class="hl-slider-hint">' + (key || '—') + '</span>',
    '    </div>',
    '    <div class="hl-loop-row">',
    '      <label class="hl-loop-label">',
    '        <input type="checkbox" id="hlLoopToggle" onchange="hlLoopToggle(this.checked)" style="accent-color:var(--accent)">',
    '        Loop section',
    '      </label>',
    '      <div id="hlLoopRange" class="hl-loop-range hl-hidden">',
    '        Bar <input type="number" id="hlLoopStart" value="1" min="1" class="hl-bar-input"> to ',
    '        <input type="number" id="hlLoopEnd" value="8" min="1" class="hl-bar-input">',
    '      </div>',
    '    </div>',
    '    <div class="hl-mixer-note">🔧 WebAudio mixer wiring coming in Phase 5</div>',
    '  </div>',
    '  <div class="hl-parts-grid" id="hl-practice-parts-grid"></div>',
    '</div>',

    // ── Record mode ──
    '<div class="hl-mode-panel" data-mode="record" style="display:none">',
    '  <!-- Headphone gate (shown until user confirms) -->',
    '  <div id="hl-headphone-gate" class="hl-gate">',
    '    <div class="hl-gate-icon">🎧</div>',
    '    <div class="hl-gate-title">Headphones Required</div>',
    '    <div class="hl-gate-desc">To prevent audio bleed onto your recording, please wear headphones before recording.</div>',
    '    <label class="hl-gate-check">',
    '      <input type="checkbox" id="hlHeadphoneConfirm" onchange="hlHeadphoneConfirmChange(this.checked)" style="accent-color:var(--accent)">',
    '      I am wearing headphones',
    '    </label>',
    '    <button class="btn btn-primary hl-gate-btn" id="hlHeadphoneConfirmBtn" disabled onclick="hlHeadphoneGate()">',
    '      Continue →',
    '    </button>',
    '  </div>',

    '  <!-- Recorder (shown after headphone gate) -->',
    '  <div id="hl-recorder-ready" class="hl-hidden">',
    '    <div class="hl-rec-header">',
    '      <div class="hl-rec-part" id="hl-rec-part-label">Select your part below to record</div>',
    '      <div class="hl-rec-timer" id="hl-rec-timer">0:00</div>',
    '    </div>',
    '    <canvas id="hl-waveform" class="hl-waveform" width="600" height="80"></canvas>',
    '    <div class="hl-rec-controls">',
    '      <button class="btn btn-primary hl-rec-btn" id="hl-rec-btn" onclick="hlStartRecording()" style="background:#ef4444;min-width:120px">',
    '        ⏺ Record',
    '      </button>',
    '    </div>',

    '    <!-- Playback (shown after recording stops) -->',
    '    <div id="hl-playback-panel" class="hl-hidden">',
    '      <div class="hl-playback-title">Review Take</div>',
    '      <audio id="hl-playback-audio" controls class="hl-playback-audio"></audio>',
    '      <div class="hl-save-actions">',
    '        <div class="hl-save-label">Save as:</div>',
    '        <button class="btn hl-save-btn" onclick="hlSaveRecording(\'private\')"  style="background:rgba(255,255,255,0.07)">🔒 Private</button>',
    '        <button class="btn hl-save-btn" onclick="hlSaveRecording(\'band\')"     style="background:rgba(102,126,234,0.2)">👥 Band</button>',
    '        <button class="btn hl-save-btn" onclick="hlSaveRecording(\'reference\')" style="background:rgba(251,191,36,0.2);color:#fbbf24">⭐ Reference</button>',
    '        <button class="btn hl-save-btn" onclick="hlDiscardRecording()"          style="background:rgba(239,68,68,0.15);color:#f87171">🗑 Discard</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>',

    '</div>', // hl-center

    // Right panel — takes
    '<div class="hl-right-panel">',
    '  <div class="hl-rail-title">My Takes</div>',
    '  <div id="hl-my-takes" class="hl-takes-list"><div class="hl-rail-empty">No takes yet</div></div>',
    '  <div class="hl-rail-title" style="margin-top:16px">Band Reference</div>',
    '  <div id="hl-band-takes" class="hl-takes-list"><div class="hl-rail-empty">No reference take</div></div>',
    '</div>',

    '</div>', // hl-body
    '</div>', // hl-root
  ].join('');
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function _hlLoadData(songTitle) {
  // Load harmony sections/parts from existing Firebase structure
  if (typeof loadBandDataFromDrive !== 'function') return;

  try {
    var data = await loadBandDataFromDrive(songTitle, 'harmonies_data');
    _hlRenderSections(data);
    _hlRenderParts(data);
  } catch(e) {
    var list = document.getElementById('hl-sections-list');
    if (list) list.innerHTML = '<div class="hl-rail-empty">No sections yet</div>';
  }

  // Load my takes
  _hlRefreshMyTakes(songTitle);
}

function _hlRenderSections(data) {
  var list = document.getElementById('hl-sections-list');
  if (!list) return;

  var sections = data && data.sections
    ? (Array.isArray(data.sections) ? data.sections : Object.values(data.sections))
    : [];

  _hlSections = sections;

  if (!sections.length) {
    list.innerHTML = '<div class="hl-rail-empty">Add sections in Band tab</div>';
    return;
  }

  list.innerHTML = sections.map(function(sec, i) {
    var name = sec.name || sec.label || ('Section ' + (i+1));
    return '<div class="hl-section-item" data-idx="' + i + '" onclick="hlSelectSection(' + i + ')">' +
           _hlEsc(name) +
           '</div>';
  }).join('');
}

function _hlRenderParts(data) {
  var grid = document.getElementById('hl-parts-grid');
  var practiceGrid = document.getElementById('hl-practice-parts-grid');
  if (!grid) return;

  var sections = data && data.sections
    ? (Array.isArray(data.sections) ? data.sections : Object.values(data.sections))
    : [];

  // Collect all unique singers across sections
  var singerSet = {};
  sections.forEach(function(sec) {
    if (sec.parts && typeof sec.parts === 'object') {
      Object.keys(sec.parts).forEach(function(singer) { singerSet[singer] = true; });
    }
  });
  var singers = Object.keys(singerSet);

  // If no harmony data yet, show default part cards
  if (!singers.length) {
    var defaultParts = [
      { name: 'Lead',         role: 'lead',  icon: '🎤', singer: '—' },
      { name: 'High Harmony', role: 'high',  icon: '⬆️', singer: '—' },
      { name: 'Low Harmony',  role: 'low',   icon: '⬇️', singer: '—' },
    ];
    grid.innerHTML = defaultParts.map(_hlPartCardHTML).join('') +
      '<div class="hl-parts-hint">Add harmony parts in the Band tab to see them here</div>';
    if (practiceGrid) practiceGrid.innerHTML = grid.innerHTML;
    return;
  }

  var cards = singers.map(function(singer, i) {
    var roles = ['lead','high','mid','low'];
    return _hlPartCardHTML({
      name:   singer.charAt(0).toUpperCase() + singer.slice(1),
      role:   roles[i] || 'optional',
      icon:   i === 0 ? '🎤' : i === 1 ? '⬆️' : '⬇️',
      singer: singer,
    });
  }).join('');

  grid.innerHTML = cards;
  if (practiceGrid) practiceGrid.innerHTML = cards;
}

function _hlPartCardHTML(part) {
  var roleColors = { lead:'#667eea', high:'#10b981', mid:'#f59e0b', low:'#ec4899', optional:'#64748b' };
  var color = roleColors[part.role] || '#667eea';
  return [
    '<div class="hl-part-card">',
    '  <div class="hl-part-icon">' + part.icon + '</div>',
    '  <div class="hl-part-name">' + _hlEsc(part.name) + '</div>',
    '  <div class="hl-part-role" style="color:' + color + '">' + _hlEsc(part.role) + '</div>',
    '  <div class="hl-part-singer">' + _hlEsc(part.singer) + '</div>',
    '  <button class="hl-part-guide-btn" onclick="hlPlayGuide(\'' + _hlEsc(part.singer) + '\')">▶ Guide</button>',
    '</div>',
  ].join('');
}

async function _hlRefreshMyTakes(songTitle) {
  var container = document.getElementById('hl-my-takes');
  if (!container) return;
  if (typeof loadHarmonyAudioSnippets !== 'function') return;

  try {
    // loadHarmonyAudioSnippets uses section index 0 as a fallback
    var snippets = await loadHarmonyAudioSnippets(songTitle, 0);
    if (!snippets || !snippets.length) {
      container.innerHTML = '<div class="hl-rail-empty">No takes yet</div>';
      return;
    }
    container.innerHTML = snippets.map(function(snip, i) {
      return '<div class="hl-take-item">' +
             '<span class="hl-take-name">' + _hlEsc(snip.name || ('Take ' + (i+1))) + '</span>' +
             (snip.url ? '<audio src="' + _hlEsc(snip.url) + '" controls class="hl-take-audio"></audio>' : '') +
             '</div>';
    }).join('');
  } catch(e) {
    container.innerHTML = '<div class="hl-rail-empty">Could not load takes</div>';
  }
}

// ── Section selection ─────────────────────────────────────────────────────────

window.hlSelectSection = function hlSelectSection(idx) {
  _hlActiveSection = idx;
  document.querySelectorAll('.hl-section-item').forEach(function(el) {
    el.classList.toggle('hl-section-item--active', parseInt(el.dataset.idx) === idx);
  });
};

// ── Mixer controls (visual only — Phase 5 wires WebAudio) ────────────────────

window.hlSetMixer = function hlSetMixer(mode) {
  _hlMixerState.mixer = mode;
  ['full','solo','mute','backing'].forEach(function(m) {
    var btn = document.getElementById('hlMix' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.classList.toggle('hl-mix-btn--active', m === mode);
  });
};

window.hlTempoChange = function hlTempoChange(val) {
  _hlMixerState.tempo = parseInt(val);
  var display = document.getElementById('hlTempoVal');
  if (display) display.textContent = val + '%';
  var bpm = _hlGetSongBpm();
  var bpmDisplay = document.getElementById('hlTempoBpm');
  if (bpmDisplay && bpm) bpmDisplay.textContent = Math.round(bpm * val / 100) + ' BPM';
};

window.hlTransposeChange = function hlTransposeChange(val) {
  _hlMixerState.transpose = parseInt(val);
  var display = document.getElementById('hlTransposeVal');
  if (display) display.textContent = (val > 0 ? '+' : '') + val;
  var key = _hlGetSongKey();
  var keyDisplay = document.getElementById('hlTransposeKey');
  if (keyDisplay) keyDisplay.textContent = key ? _hlTransposeKey(key, parseInt(val)) : '—';
};

window.hlLoopToggle = function hlLoopToggle(on) {
  _hlMixerState.loopEnabled = on;
  var range = document.getElementById('hlLoopRange');
  if (range) range.classList.toggle('hl-hidden', !on);
};

window.hlPlayGuide = function hlPlayGuide(singer) {
  if (typeof showToast === 'function') showToast('Guide track for ' + singer + ' not yet uploaded');
};

// ── Headphone gate ────────────────────────────────────────────────────────────

function _hlCheckHeadphones() {
  var gate = document.getElementById('hl-headphone-gate');
  if (gate) gate.style.display = 'block';
  var ready = document.getElementById('hl-recorder-ready');
  if (ready) ready.classList.add('hl-hidden');
}

window.hlHeadphoneConfirmChange = function hlHeadphoneConfirmChange(checked) {
  var btn = document.getElementById('hlHeadphoneConfirmBtn');
  if (btn) btn.disabled = !checked;
};

// ── Recording helpers ─────────────────────────────────────────────────────────

function _hlOnRecordingStop() {
  var blob  = new Blob(_hlChunks, { type: 'audio/webm' });
  _hlBlobUrl = URL.createObjectURL(blob);

  var audio = document.getElementById('hl-playback-audio');
  if (audio) audio.src = _hlBlobUrl;

  var playback = document.getElementById('hl-playback-panel');
  if (playback) playback.classList.remove('hl-hidden');

  var recBtn = document.getElementById('hl-rec-btn');
  if (recBtn) { recBtn.textContent = '⏺ Record Again'; recBtn.style.background = '#ef4444'; recBtn.onclick = function() { window.hlStartRecording(); }; }
}

window.hlDiscardRecording = function hlDiscardRecording() {
  _hlBlobUrl = null;
  _hlChunks = [];
  var playback = document.getElementById('hl-playback-panel');
  if (playback) playback.classList.add('hl-hidden');
  var audio = document.getElementById('hl-playback-audio');
  if (audio) audio.src = '';
  if (typeof showToast === 'function') showToast('Take discarded');
};

// ── Timer ─────────────────────────────────────────────────────────────────────

var _hlTimerInterval = null;
var _hlTimerSecs = 0;
function _hlStartTimer() {
  _hlTimerSecs = 0;
  _hlTimerInterval = setInterval(function() {
    _hlTimerSecs++;
    var el = document.getElementById('hl-rec-timer');
    if (el) el.textContent = Math.floor(_hlTimerSecs/60) + ':' + String(_hlTimerSecs%60).padStart(2,'0');
  }, 1000);
}
function _hlStopTimer() { clearInterval(_hlTimerInterval); }
function _hlGetRecordingDuration() { return _hlTimerSecs; }

// ── Waveform animation ────────────────────────────────────────────────────────

var _hlWaveAnimId = null;
function _hlStartWaveformAnimation() {
  var canvas = document.getElementById('hl-waveform');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  var phase = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(102,126,234,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var x = 0; x < w; x++) {
      var amp = 20 + Math.random() * 15;
      var y = h/2 + Math.sin((x * 0.04) + phase) * amp * (0.5 + Math.random() * 0.5);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    phase += 0.15;
    _hlWaveAnimId = requestAnimationFrame(draw);
  }
  draw();
}
function _hlStopWaveformAnimation() {
  if (_hlWaveAnimId) cancelAnimationFrame(_hlWaveAnimId);
  var canvas = document.getElementById('hl-waveform');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(102,126,234,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height/2);
  ctx.lineTo(canvas.width, canvas.height/2);
  ctx.stroke();
}

// ── Key transposition helper ──────────────────────────────────────────────────

var _hlNotes = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function _hlTransposeKey(key, semitones) {
  var minor = key.endsWith('m');
  var root  = minor ? key.slice(0,-1) : key;
  var idx   = _hlNotes.indexOf(root);
  if (idx < 0) return key;
  var newRoot = _hlNotes[(idx + semitones + 12) % 12];
  return newRoot + (minor ? 'm' : '');
}

// ── Song meta helpers ─────────────────────────────────────────────────────────

function _hlGetSongKey() {
  var sel = document.getElementById('sd-songKeySelect') || document.getElementById('songKeySelect');
  return sel ? sel.value : '';
}
function _hlGetSongBpm() {
  var inp = document.getElementById('sd-songBpmInput') || document.getElementById('songBpmInput');
  var v = inp ? parseInt(inp.value) : 0;
  return (v && !isNaN(v)) ? v : null;
}
function _hlEsc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Styles ────────────────────────────────────────────────────────────────────

function _hlInjectStyles() {
  if (document.getElementById('hl-styles')) return;
  var s = document.createElement('style');
  s.id = 'hl-styles';
  s.textContent = `
/* ── Harmony Lab ─────────────────────────────────────────────── */
.hl-root {
  display: flex;
  flex-direction: column;
  background: var(--bg, #0f172a);
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  overflow: hidden;
}

/* Header */
.hl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 16px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
}
.hl-header-song { font-size: 1.05em; font-weight: 800; color: var(--text, #f1f5f9); }
.hl-header-meta { display: flex; gap: 6px; margin-top: 2px; }
.hl-meta-badge {
  font-size: 0.72em; font-weight: 700;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(255,255,255,0.07);
  color: var(--text-muted, #94a3b8);
  border: 1px solid rgba(255,255,255,0.08);
}
.hl-mode-switcher { display: flex; gap: 4px; }
.hl-mode-btn {
  padding: 6px 12px; border-radius: 8px; font-size: 0.78em; font-weight: 700;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: var(--text-muted, #94a3b8); cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.hl-mode-btn:hover { background: rgba(255,255,255,0.06); color: var(--text, #f1f5f9); }
.hl-mode-btn--active { background: var(--accent, #667eea); color: white; border-color: var(--accent, #667eea); }

/* Body layout */
.hl-body {
  display: grid;
  grid-template-columns: 120px 1fr 160px;
  min-height: 400px;
}
@media (max-width: 600px) {
  .hl-body { grid-template-columns: 1fr; }
  .hl-left-rail, .hl-right-panel { display: none; }
}

/* Left rail */
.hl-left-rail {
  border-right: 1px solid var(--border, rgba(255,255,255,0.06));
  padding: 12px 8px;
  overflow-y: auto;
}
.hl-rail-title {
  font-size: 0.68em; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-dim, #64748b); margin-bottom: 8px;
}
.hl-section-item {
  font-size: 0.8em; padding: 6px 8px; border-radius: 6px; cursor: pointer;
  color: var(--text-muted, #94a3b8); transition: all 0.12s; margin-bottom: 3px;
}
.hl-section-item:hover { background: rgba(255,255,255,0.06); color: var(--text, #f1f5f9); }
.hl-section-item--active { background: rgba(102,126,234,0.15); color: #818cf8; font-weight: 700; }
.hl-rail-empty { font-size: 0.78em; color: var(--text-dim, #64748b); font-style: italic; padding: 4px; }

/* Center */
.hl-center { padding: 16px; overflow-y: auto; }

/* Parts grid */
.hl-parts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.hl-part-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 14px 12px;
  text-align: center;
  transition: all 0.15s;
}
.hl-part-card:hover { border-color: rgba(102,126,234,0.4); background: rgba(102,126,234,0.06); }
.hl-part-icon { font-size: 1.6em; margin-bottom: 6px; }
.hl-part-name { font-size: 0.85em; font-weight: 800; color: var(--text, #f1f5f9); margin-bottom: 3px; }
.hl-part-role { font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.hl-part-singer { font-size: 0.78em; color: var(--text-muted, #94a3b8); margin-bottom: 8px; }
.hl-part-guide-btn {
  font-size: 0.72em; padding: 4px 10px; border-radius: 6px; cursor: pointer;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-muted, #94a3b8); transition: all 0.12s;
}
.hl-part-guide-btn:hover { background: rgba(255,255,255,0.12); color: var(--text, #f1f5f9); }
.hl-parts-hint { font-size: 0.78em; color: var(--text-dim, #64748b); text-align: center; padding: 12px; grid-column: 1/-1; }

/* Notation */
.hl-notation-area { margin-top: 12px; }
.hl-notation-label { font-size: 0.72em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim, #64748b); margin-bottom: 8px; }
.hl-abc-placeholder {
  background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.12);
  border-radius: 8px; padding: 30px; text-align: center;
}
.hl-abc-icon { font-size: 2.5em; opacity: 0.3; margin-bottom: 8px; }
.hl-abc-msg { font-size: 0.82em; color: var(--text-dim, #64748b); }

/* Mixer */
.hl-mixer { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.hl-mixer-title { font-size: 0.78em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim, #64748b); margin-bottom: 10px; }
.hl-mixer-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.hl-mix-btn {
  padding: 7px 12px; border-radius: 8px; font-size: 0.78em; font-weight: 700;
  border: 1px solid rgba(255,255,255,0.1); background: transparent;
  color: var(--text-muted, #94a3b8); cursor: pointer; transition: all 0.12s;
}
.hl-mix-btn:hover { background: rgba(255,255,255,0.06); }
.hl-mix-btn--active { background: rgba(102,126,234,0.2); color: #818cf8; border-color: rgba(102,126,234,0.4); }
.hl-slider-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.hl-slider-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted, #94a3b8); min-width: 90px; white-space: nowrap; }
.hl-slider { flex: 1; accent-color: var(--accent, #667eea); }
.hl-slider-hint { font-size: 0.72em; color: var(--text-dim, #64748b); min-width: 60px; }
.hl-loop-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.hl-loop-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 6px; cursor: pointer; }
.hl-loop-range { font-size: 0.78em; color: var(--text-muted, #94a3b8); display: flex; align-items: center; gap: 5px; }
.hl-bar-input { width: 48px; padding: 3px 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: var(--text, #f1f5f9); font-size: 0.9em; text-align: center; }
.hl-mixer-note { font-size: 0.72em; color: var(--text-dim, #64748b); margin-top: 8px; font-style: italic; }

/* Record mode */
.hl-gate {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 32px 24px; text-align: center;
}
.hl-gate-icon { font-size: 2.5em; margin-bottom: 12px; }
.hl-gate-title { font-size: 1.1em; font-weight: 800; color: var(--text, #f1f5f9); margin-bottom: 8px; }
.hl-gate-desc { font-size: 0.88em; color: var(--text-muted, #94a3b8); margin-bottom: 16px; line-height: 1.5; max-width: 300px; margin-left: auto; margin-right: auto; }
.hl-gate-check { display: flex; align-items: center; gap: 8px; justify-content: center; font-size: 0.88em; color: var(--text, #f1f5f9); margin-bottom: 16px; cursor: pointer; }
.hl-gate-btn { width: 100%; max-width: 200px; }
.hl-rec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.hl-rec-part { font-size: 0.85em; color: var(--text-muted, #94a3b8); }
.hl-rec-timer { font-size: 1.4em; font-weight: 800; color: #ef4444; font-variant-numeric: tabular-nums; }
.hl-waveform { width: 100%; height: 80px; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 12px; display: block; }
.hl-rec-controls { display: flex; gap: 8px; justify-content: center; }
.hl-rec-btn { min-width: 130px; }
.hl-playback-title { font-size: 0.85em; font-weight: 700; color: var(--text-muted, #94a3b8); margin-bottom: 8px; }
.hl-playback-audio { width: 100%; margin-bottom: 12px; }
.hl-save-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.hl-save-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted, #94a3b8); margin-right: 4px; }
.hl-save-btn { font-size: 0.78em !important; padding: 7px 12px !important; border-radius: 8px !important; }

/* Right panel */
.hl-right-panel {
  border-left: 1px solid var(--border, rgba(255,255,255,0.06));
  padding: 12px 10px;
  overflow-y: auto;
}
.hl-takes-list { }
.hl-take-item { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.hl-take-name { font-size: 0.78em; font-weight: 700; color: var(--text-muted, #94a3b8); display: block; margin-bottom: 3px; }
.hl-take-audio { width: 100%; height: 28px; }
.hl-loading { font-size: 0.82em; color: var(--text-dim, #64748b); padding: 8px 0; }

/* Utilities */
.hl-hidden { display: none !important; }
  `;
  document.head.appendChild(s);
}

console.log('✅ harmony-lab.js loaded');
