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
var _hlAssets        = [];   // harmony_assets loaded from Firebase
var _hlCurrentAudio  = null; // currently playing HTMLAudioElement

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

  // Stab #06 lifecycle: Harmony Lab mounts inside Song Detail's harmony
  // lens. When the user leaves the songdetail route, pause every audio
  // element this lab created (split-mixer parts + the take-review element).
  // Registering on every mount is safe — GLRouteLifecycle de-dupes by
  // function reference and clears disposers after they fire.
  if (typeof window !== 'undefined'
      && window.GLRouteLifecycle
      && typeof window.GLRouteLifecycle.register === 'function') {
    window.GLRouteLifecycle.register('songdetail', _hlCleanup);
  }
};

// Stab #07 — register `_hlCleanup` as the pausable for harmony-lab so the
// global pauseAll() arbitrator can quiet it when another surface asserts
// ownership. Idempotent: registerPausable de-dupes by id. Runs at module
// load (with a small defer if GLPlayerContract isn't ready yet).
(function _hlRegisterPausable() {
  if (typeof window === 'undefined') return;
  if (!window.GLPlayerContract || typeof window.GLPlayerContract.registerPausable !== 'function') {
    setTimeout(_hlRegisterPausable, 0);
    return;
  }
  window.GLPlayerContract.registerPausable('harmony-lab', _hlCleanup);
})();

// Stab #06 — pause every audio element Harmony Lab has open. Idempotent
// and safe to call from any state. Does NOT close the AudioContext —
// that lives on _hlMixState.ctx and is reused when the user comes back
// to the lab on the same song (closing it would force a one-time
// `new AudioContext()` cost on every re-entry).
function _hlCleanup() {
  try {
    if (_hlMixState && _hlMixState.audios) {
      Array.prototype.forEach.call(_hlMixState.audios, function(a) {
        try { a.pause(); } catch(e) {}
      });
    }
  } catch (e) {}
  try {
    if (_hlCurrentAudio) {
      _hlCurrentAudio.pause();
    }
  } catch (e) {}
  // Pause the take-review element if it's playing
  try {
    var rev = document.getElementById('hl-playback-audio');
    if (rev && !rev.paused) rev.pause();
  } catch (e) {}
}

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
  var safeSong = _hlEsc(title).replace(/'/g, "\\'");

  return [
    '<div class="hl-root" style="max-width:640px;margin:0 auto">',

    // ── HERO: Create Harmony Parts ──
    '<div style="text-align:center;padding:18px 16px;margin-bottom:14px;background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(236,72,153,0.03));border:1px solid rgba(99,102,241,0.15);border-radius:12px">',
    '  <div style="font-size:1.05em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:10px">🎤 Create Harmony</div>',
    '  <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">',
    '    <button onclick="hlShowGenerateGuide(\'lead\',\'lead\')" style="padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;font-size:0.85em;cursor:pointer;box-shadow:0 2px 8px rgba(99,102,241,0.2)">✨ Generate from Song</button>',
    '    <button onclick="hlSwitchMode(\'record\')" style="padding:10px 18px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:var(--text-muted,#94a3b8);font-weight:600;font-size:0.85em;cursor:pointer">⏺ Record Manually</button>',
    '    <button onclick="hlToggleImportForm()" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:var(--text-muted,#94a3b8);font-weight:600;font-size:0.82em;cursor:pointer">📁 Import Stems</button>',
    '  </div>',
    '</div>',

    // ── Progress indicator ──
    '<div id="hl-progress" style="text-align:center;font-size:0.75em;font-weight:600;color:var(--text-dim,#475569);margin-bottom:12px;letter-spacing:0.02em">Loading parts…</div>',

    // ── Learn mode (default, single-column) ──
    '<div class="hl-mode-panel" data-mode="learn">',

    // Harmony Parts
    '  <div class="hl-parts-grid" id="hl-parts-grid" style="display:flex;flex-direction:column;gap:10px">',
    '    <div class="hl-loading">Loading harmony parts…</div>',
    '  </div>',

    // My Takes + Band Reference
    '  <div style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap">',
    '    <div style="flex:1;min-width:180px">',
    '      <div class="hl-rail-title">My Takes</div>',
    '      <div id="hl-my-takes" class="hl-takes-list"><div class="hl-rail-empty">No takes yet</div></div>',
    '    </div>',
    '    <div style="flex:1;min-width:180px">',
    '      <div class="hl-rail-title">Band Reference</div>',
    '      <div id="hl-band-takes" class="hl-takes-list"><div class="hl-rail-empty">No reference take</div></div>',
    '    </div>',
    '  </div>',

    // Guide Tracks
    '  <div class="hl-section-title" style="margin-top:16px">Guide Tracks</div>',
    '  <div id="hl-asset-player" class="hl-asset-player"><div class="hl-asset-empty" style="font-size:0.78em;color:var(--text-dim,#475569)">No guide tracks yet</div></div>',
    '  <button id="hl-add-guide-btn" onclick="hlToggleImportForm()" style="margin-top:8px;padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted,#94a3b8);cursor:pointer;font-size:0.78em;font-weight:600;width:100%">+ Add Guide Track</button>',
    '  <div id="hl-import-panel" class="hl-import-panel" style="display:none" ondragover="event.preventDefault();this.classList.add(\'hl-import-drag\')" ondragleave="this.classList.remove(\'hl-import-drag\')" ondrop="hlHandleImportDrop(event)">',
    '    <div class="hl-import-row">',
    '      <input id="hl-import-label-input" class="hl-import-input" type="text" placeholder="Label (e.g. High Harmony)" style="max-width:160px">',
    '      <input id="hl-import-url-input" class="hl-import-input" type="url" placeholder="Paste direct audio URL (.mp3, .wav…)" style="flex:1">',
    '      <button id="hl-import-url-btn" class="btn btn-sm btn-primary" onclick="hlImportAssetFromUrl()">Import</button>',
    '    </div>',
    '    <div id="hl-url-error" class="hl-url-error" style="display:none"></div>',
    '    <div class="hl-import-row" style="margin-top:6px">',
    '      <label class="hl-import-file-label">📁 Upload or Drop File (max 20MB)<input type="file" accept="audio/*" style="display:none" onchange="hlImportAssetFromFile(this)"></label>',
    '    </div>',
    '  </div>',

    // ── LALAL / Fadr split mixer (renders only if parts[] has audio_url) ──
    '  <div id="hl-split-mixer" style="display:none;margin-top:16px"></div>',

    // Notation (collapsed — renders lead's ABC notes via abcjs when available)
    '  <details class="sd-details" id="hl-abc-details" style="margin-top:16px" open>',
    '    <summary style="padding:8px 12px;font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim,#475569);cursor:pointer">🎼 Lead Notation</summary>',
    '    <div style="padding:8px 12px">',
    '      <div id="hl-abc-container" class="hl-abc-placeholder">',
    '        <div class="hl-abc-icon">𝄞</div>',
    '        <div class="hl-abc-msg">No lead notation yet — Generate from Demucs vocals to populate</div>',
    '      </div>',
    '    </div>',
    '  </details>',

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

    '</div>', // hl-root
  ].join('');
}

// Toggle import guide track form
window.hlToggleImportForm = function hlToggleImportForm() {
  var panel = document.getElementById('hl-import-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

// ── Data loading ──────────────────────────────────────────────────────────────

// ── Label + URL helpers ───────────────────────────────────────────────────────

function _hlSmartLabel(url) {
  if (!url) return 'Track';
  try {
    var decoded = decodeURIComponent(url);
    // Strip query string and fragment
    var clean = decoded.split('?')[0].split('#')[0];
    // Get basename
    var base = clean.split('/').filter(Boolean).pop() || '';
    // Remove extension
    base = base.replace(/\.(mp3|wav|ogg|m4a|flac|aac)$/i, '');
    // Replace dashes/underscores with spaces, trim
    base = base.replace(/[-_]+/g, ' ').trim();
    // Truncate
    if (base.length > 40) base = base.slice(0, 40) + '…';
    return base || 'Track';
  } catch(e) { return 'Track'; }
}

// Returns null if URL is ok to import, or an error string if not
function _hlValidateAudioUrl(url) {
  if (!url) return 'Please enter a URL';
  var lower = url.toLowerCase();
  if (lower.includes('open.spotify.com') || lower.includes('spotify.com/track')) {
    return 'Spotify links are not direct audio files. Use the file upload instead, or find a direct .mp3/.wav URL. (Spotify embeds are planned for a future update.)';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'YouTube links are not direct audio files. Use the file upload instead, or find a direct .mp3/.wav URL. (YouTube embeds are planned for a future update.)';
  }
  if (lower.includes('soundcloud.com')) {
    return 'SoundCloud links are not direct audio files. Use the file upload instead, or find a direct .mp3/.wav URL.';
  }
  if (!lower.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/)) {
    // Warn but don't block — could be a CDN URL without extension
    return null; // allow with no warning
  }
  return null;
}

async function _hlLoadData(songTitle) {
  if (typeof loadBandDataFromDrive !== 'function') return;

  var results = await Promise.allSettled([
    loadBandDataFromDrive(songTitle, 'harmonies_data'),
    _hlLoadAssets(songTitle),
  ]);

  try {
    _hlRenderSections(results[0].value);
    _hlRenderParts(results[0].value);
    _hlRenderSplitMixer(results[0].value);
    _hlRenderLeadNotation(results[0].value);
  } catch(e) {
    var list = document.getElementById('hl-sections-list');
    if (list) list.innerHTML = '<div class="hl-rail-empty">No sections yet</div>';
  }

  _hlAssets = (results[1].status === 'fulfilled' && results[1].value) ? results[1].value : [];
  _hlRenderAssetPlayer(_hlAssets);
  _hlRefreshMyTakes(songTitle);
}

// ── Harmony Audio Mixer (Phase 1.6 + 1.8) ────────────────────────────────────
// Renders a synced multi-track mixer when `harmonies_data.sections[].parts[]`
// has `audio_url` entries (written by LALAL/Fadr orchestrators in app.js).
// Mute/solo/volume/pan + phrase loop. Mirrors Stems lens audio chain pattern.
// ─────────────────────────────────────────────────────────────────────────────

var _hlMixState = null; // { ctx, nodes:{partId:{src,gain,pan}}, audios, master, soloed, loop:{on,startBar,endBar,bpm} }

function _hlRenderSplitMixer(harmoniesData) {
  var host = document.getElementById('hl-split-mixer');
  if (!host) return;
  var sections = (harmoniesData && harmoniesData.sections)
    ? (Array.isArray(harmoniesData.sections) ? harmoniesData.sections : Object.values(harmoniesData.sections))
    : [];
  // Flatten audio-url-bearing parts across sections; tag with section name + index.
  var audioParts = [];
  sections.forEach(function(sec, sIdx) {
    var parts = sec && sec.parts;
    if (!parts) return;
    var arr = Array.isArray(parts) ? parts : Object.values(parts);
    arr.forEach(function(p, pIdx) {
      if (p && p.audio_url) {
        audioParts.push({
          partId:  's' + sIdx + '_p' + pIdx,
          singer:  p.singer || ('Part ' + (pIdx+1)),
          part:    p.part || 'voice',
          source:  p.source || 'manual',
          quality: p.notation_quality || '',
          url:     p.audio_url,
          notes:   p.notes || null,
          section: sec.name || 'Section ' + (sIdx+1)
        });
      }
    });
  });
  if (!audioParts.length) {
    host.style.display = 'none';
    host.innerHTML = '';
    return;
  }
  host.style.display = 'block';
  var bpm = _hlGetSongBpm() || 120;
  var rows = audioParts.map(function(p) {
    var roleColors = { lead:'#667eea', high:'#10b981', harmony:'#10b981', mid:'#f59e0b', low:'#ec4899', backing:'#ec4899', voice:'#94a3b8' };
    var color = roleColors[p.part] || '#94a3b8';
    var srcBadge = p.source === 'lalal' ? '<span class="hl-mix-badge" style="background:rgba(99,102,241,0.18);color:#a5b4fc">LALAL</span>'
                 : p.source === 'fadr'  ? '<span class="hl-mix-badge" style="background:rgba(5,150,105,0.18);color:#6ee7b7">Fadr</span>'
                 : '';
    return '<div class="hl-mix-row" data-part="' + p.partId + '">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.85em;font-weight:700;color:' + color + '">' + _hlEsc(p.singer) + ' <span style="font-size:0.7em;color:var(--text-dim,#64748b);font-weight:600">· ' + _hlEsc(p.part) + '</span> ' + srcBadge + '</div>' +
          '<input type="range" min="0" max="100" value="80" class="hl-mix-vol" data-part="' + p.partId + '" style="width:100%;margin-top:4px;accent-color:' + color + '" title="Volume">' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0" title="Pan (L ↔ R) — double-click to center">' +
          '<input type="range" min="-100" max="100" value="0" class="hl-mix-pan" data-part="' + p.partId + '" style="width:60px;accent-color:' + color + '">' +
          '<span class="hl-mix-pan-val" data-part="' + p.partId + '" style="font-size:0.62em;color:var(--text-dim,#64748b);font-variant-numeric:tabular-nums;line-height:1">C</span>' +
        '</div>' +
        '<button class="hl-mix-mute" data-part="' + p.partId + '">Mute</button>' +
        '<button class="hl-mix-solo" data-part="' + p.partId + '">Solo</button>' +
        '<audio class="hl-mix-audio" data-part="' + p.partId + '" preload="auto" crossorigin="anonymous" src="' + _hlEsc(p.url) + '"></audio>' +
      '</div>';
  }).join('');
  host.innerHTML =
    '<div class="hl-mix-card">' +
      '<div class="hl-mix-card-title">🎚 Split Mixer <span class="hl-mix-subtitle">' + audioParts.length + ' track' + (audioParts.length===1?'':'s') + '</span></div>' +
      '<div class="hl-mix-transport">' +
        '<button id="hl-mix-play" type="button">▶ Play</button>' +
        '<input id="hl-mix-scrub" type="range" min="0" max="1000" value="0" style="flex:1;min-width:100px">' +
        '<span id="hl-mix-time" class="hl-mix-time">0:00 / 0:00</span>' +
      '</div>' +
      '<div class="hl-mix-loop">' +
        '<label><input type="checkbox" id="hl-mix-loop-toggle"> Loop bars</label>' +
        '<span class="hl-mix-loop-fields">' +
          '<input type="number" id="hl-mix-loop-start" min="1" value="1" class="hl-bar-input"> to ' +
          '<input type="number" id="hl-mix-loop-end" min="1" value="8" class="hl-bar-input">' +
        '</span>' +
        '<span class="hl-mix-loop-hint">@ ' + bpm + ' BPM, 4/4 (' + (240 / bpm).toFixed(1) + 's/bar)</span>' +
      '</div>' +
      rows +
    '</div>';
  _hlInitSplitMixer(audioParts, bpm);
}

function _hlInitSplitMixer(audioParts, bpm) {
  var root = document;
  var audios = root.querySelectorAll('.hl-mix-audio');
  if (!audios.length) return;
  var master = audios[0];

  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var nodes = {};
  if (AC) {
    try {
      ctx = new AC();
      audios.forEach(function(audio) {
        audio.volume = 1;
        var src  = ctx.createMediaElementSource(audio);
        var gain = ctx.createGain(); gain.gain.value = 0.8;
        var pan  = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
        if (pan) src.connect(gain).connect(pan).connect(ctx.destination);
        else     src.connect(gain).connect(ctx.destination);
        nodes[audio.dataset.part] = { src: src, gain: gain, pan: pan };
      });
    } catch(e) { console.warn('[HarmonyLab] WebAudio init failed:', e); ctx = null; nodes = {}; }
  }

  var fmt = function(s){ s = Math.floor(s||0); return Math.floor(s/60) + ':' + ('0'+(s%60)).slice(-2); };
  _hlMixState = {
    ctx: ctx, nodes: nodes, audios: audios, master: master, soloed: null,
    loop: { on: false, startBar: 1, endBar: 8, bpm: bpm }
  };

  var applyVol = function(audio) {
    var part = audio.dataset.part;
    var slider = root.querySelector('.hl-mix-vol[data-part="' + part + '"]');
    var v = slider ? Number(slider.value) / 100 : 0.8;
    var muted = audio.dataset.muted === '1';
    var soloOff = audio.dataset.soloOff === '1';
    var out = (muted || soloOff) ? 0 : Math.max(0, Math.min(1, v));
    var n = nodes[part];
    if (n) { try { n.gain.gain.value = out; } catch(e) {} }
    else { audio.volume = out; }
  };
  var applyPan = function(part, val) {
    var v = Math.max(-1, Math.min(1, Number(val) / 100));
    var n = nodes[part];
    if (n && n.pan) { try { n.pan.pan.value = v; } catch(e) {} }
    var lab = root.querySelector('.hl-mix-pan-val[data-part="' + part + '"]');
    if (lab) lab.textContent = v === 0 ? 'C' : (v < 0 ? 'L' + Math.round(-v*100) : 'R' + Math.round(v*100));
  };

  audios.forEach(function(audio) {
    var part = audio.dataset.part;
    var vSlider = root.querySelector('.hl-mix-vol[data-part="' + part + '"]');
    if (vSlider) vSlider.addEventListener('input', function(){ applyVol(audio); });
    applyVol(audio);
  });
  root.querySelectorAll('.hl-mix-pan').forEach(function(s) {
    s.addEventListener('input', function(){ applyPan(s.dataset.part, s.value); });
    s.addEventListener('dblclick', function(){ s.value = 0; applyPan(s.dataset.part, 0); });
  });
  root.querySelectorAll('.hl-mix-mute').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var audio = root.querySelector('.hl-mix-audio[data-part="' + btn.dataset.part + '"]');
      if (!audio) return;
      var muted = audio.dataset.muted === '1';
      audio.dataset.muted = muted ? '' : '1';
      applyVol(audio);
      btn.classList.toggle('hl-mix-btn-on', !muted);
    });
  });
  root.querySelectorAll('.hl-mix-solo').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var part = btn.dataset.part;
      _hlMixState.soloed = (_hlMixState.soloed === part) ? null : part;
      audios.forEach(function(a) {
        a.dataset.soloOff = (_hlMixState.soloed && a.dataset.part !== _hlMixState.soloed) ? '1' : '';
        applyVol(a);
      });
      root.querySelectorAll('.hl-mix-solo').forEach(function(b) {
        b.classList.toggle('hl-mix-btn-on', _hlMixState.soloed === b.dataset.part);
      });
    });
  });

  // Transport
  var playBtn = root.querySelector('#hl-mix-play');
  var scrub   = root.querySelector('#hl-mix-scrub');
  var timeEl  = root.querySelector('#hl-mix-time');
  if (playBtn) playBtn.addEventListener('click', function() {
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch(e) {} }
    var anyPlaying = Array.prototype.some.call(audios, function(a){ return !a.paused; });
    if (anyPlaying) {
      audios.forEach(function(a){ a.pause(); });
      playBtn.textContent = '▶ Play';
    } else {
      // Stab #07 — assert single-owner playback before mixer starts.
      try {
        if (window.GLPlayerContract && typeof window.GLPlayerContract.pauseAll === 'function') {
          window.GLPlayerContract.pauseAll('harmony-lab');
        }
      } catch (e) {}
      var t = audios[0].currentTime || 0;
      audios.forEach(function(a){ try { a.currentTime = t; } catch(e){} a.play().catch(function(){}); });
      playBtn.textContent = '⏸ Pause';
    }
  });

  // Loop controls — bar→sec via BPM. Assumes 4/4; non-4/4 ignored for MVP.
  var loopToggle = root.querySelector('#hl-mix-loop-toggle');
  var loopStart  = root.querySelector('#hl-mix-loop-start');
  var loopEnd    = root.querySelector('#hl-mix-loop-end');
  var readLoop = function() {
    _hlMixState.loop.on       = !!(loopToggle && loopToggle.checked);
    _hlMixState.loop.startBar = Math.max(1, parseInt(loopStart && loopStart.value) || 1);
    _hlMixState.loop.endBar   = Math.max(_hlMixState.loop.startBar + 1, parseInt(loopEnd && loopEnd.value) || _hlMixState.loop.startBar + 1);
  };
  if (loopToggle) loopToggle.addEventListener('change', readLoop);
  if (loopStart)  loopStart.addEventListener('change', readLoop);
  if (loopEnd)    loopEnd.addEventListener('change', readLoop);
  readLoop();
  var secsPerBar = function() { return 240 / (_hlMixState.loop.bpm || 120); };

  master.addEventListener('timeupdate', function() {
    if (master.duration && scrub) scrub.value = (master.currentTime / master.duration) * 1000;
    if (timeEl && master.duration) timeEl.textContent = fmt(master.currentTime) + ' / ' + fmt(master.duration);
    // Loop check
    if (_hlMixState.loop.on) {
      var spb = secsPerBar();
      var startSec = (_hlMixState.loop.startBar - 1) * spb;
      var endSec   = (_hlMixState.loop.endBar   - 1) * spb;
      if (master.currentTime >= endSec || master.currentTime < startSec) {
        var newT = startSec;
        audios.forEach(function(a){ try { a.currentTime = newT; } catch(e){} });
      }
    }
  });
  master.addEventListener('loadedmetadata', function() {
    if (timeEl && master.duration) timeEl.textContent = '0:00 / ' + fmt(master.duration);
  });
  master.addEventListener('ended', function() {
    if (playBtn) playBtn.textContent = '▶ Play';
    audios.forEach(function(a){ try { a.pause(); a.currentTime = 0; } catch(e){} });
  });
  if (scrub) scrub.addEventListener('input', function() {
    if (!master.duration) return;
    var t = (scrub.value / 1000) * master.duration;
    audios.forEach(function(a){ try { a.currentTime = t; } catch(e){} });
  });
}

// ── Lead notation rendering (abcjs, lazy-loaded) ────────────────────────────

function _hlRenderLeadNotation(harmoniesData) {
  var container = document.getElementById('hl-abc-container');
  if (!container) return;
  var sections = (harmoniesData && harmoniesData.sections)
    ? (Array.isArray(harmoniesData.sections) ? harmoniesData.sections : Object.values(harmoniesData.sections))
    : [];
  // Find first part with non-empty notes (prefer source:'lalal' or part:'lead').
  var leadPart = null;
  for (var i = 0; i < sections.length && !leadPart; i++) {
    var parts = sections[i] && sections[i].parts;
    if (!parts) continue;
    var arr = Array.isArray(parts) ? parts : Object.values(parts);
    leadPart = arr.find(function(p){ return p && p.notes && (p.part === 'lead' || p.singer === 'lead'); })
            || arr.find(function(p){ return p && p.notes && typeof p.notes === 'string' && p.notes.indexOf('X:') === 0; });
  }
  if (!leadPart || !leadPart.notes) {
    container.innerHTML = '<div class="hl-abc-icon">𝄞</div><div class="hl-abc-msg">No lead notation yet — Generate from Demucs vocals to populate</div>';
    return;
  }
  var qualityBadge = leadPart.notation_quality === 'auto-draft'
    ? '<span class="hl-abc-quality" style="background:rgba(245,158,11,0.18);color:#fbbf24">DRAFT</span>'
    : leadPart.notation_quality === 'hand-cleaned'
    ? '<span class="hl-abc-quality" style="background:rgba(16,185,129,0.18);color:#34d399">CLEANED</span>'
    : '';
  container.classList.remove('hl-abc-placeholder');
  container.innerHTML = '<div class="hl-abc-header">' + qualityBadge +
    '<span style="font-size:0.78em;color:var(--text-dim,#64748b)">' + _hlEsc(leadPart.singer || 'Lead') + '</span></div>' +
    '<div id="hl-abc-paper" style="background:white;border-radius:8px;padding:8px;overflow-x:auto"></div>';
  _hlEnsureAbcJs().then(function() {
    var paper = document.getElementById('hl-abc-paper');
    if (paper && window.ABCJS) {
      try {
        window.ABCJS.renderAbc(paper, leadPart.notes, { responsive: 'resize', staffwidth: 700 });
      } catch(e) {
        paper.innerHTML = '<div style="color:#dc2626;padding:8px;font-size:0.82em">ABC render failed: ' + _hlEsc(e.message) + '</div>';
      }
    }
  }).catch(function(e) {
    var paper = document.getElementById('hl-abc-paper');
    if (paper) paper.innerHTML = '<div style="color:#dc2626;padding:8px;font-size:0.82em">abcjs load failed: ' + _hlEsc(e.message) + '</div>';
  });
}

var _hlAbcJsPromise = null;
function _hlEnsureAbcJs() {
  if (window.ABCJS) return Promise.resolve(window.ABCJS);
  if (_hlAbcJsPromise) return _hlAbcJsPromise;
  _hlAbcJsPromise = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.6.3/dist/abcjs-basic-min.js';
    s.onload = function(){ resolve(window.ABCJS); };
    s.onerror = function(){ reject(new Error('abcjs CDN failed')); };
    document.head.appendChild(s);
  });
  return _hlAbcJsPromise;
}

// ── Asset loading / saving ────────────────────────────────────────────────────

async function _hlLoadAssets(songTitle) {
  if (typeof firebaseDB === 'undefined' || !firebaseDB) return [];
  if (typeof bandPath !== 'function') return [];
  try {
    var key = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(songTitle) : songTitle;
    var snap = await firebaseDB.ref(bandPath('songs/' + key + '/harmony_assets')).once('value');
    var val = snap.val();
    if (!val) return [];
    return Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
  } catch(e) {
    console.warn('[HarmonyLab] _hlLoadAssets failed:', e);
    return [];
  }
}

async function _hlSaveAsset(songTitle, asset) {
  if (typeof firebaseDB === 'undefined' || !firebaseDB) throw new Error('No Firebase');
  if (typeof bandPath !== 'function') throw new Error('No bandPath');
  var key = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(songTitle) : songTitle;
  var assetKey = asset._key || (Date.now() + '_' + Math.random().toString(36).slice(2,7));
  var record = Object.assign({}, asset, { createdAt: asset.createdAt || new Date().toISOString() });
  delete record._key;
  await firebaseDB.ref(bandPath('songs/' + key + '/harmony_assets/' + assetKey)).set(record);
  return assetKey;
}

function _hlRenderSections(data) {
  var list = document.getElementById('hl-sections-list');
  if (!list) return;

  var sections = data && data.sections
    ? (Array.isArray(data.sections) ? data.sections : Object.values(data.sections))
    : [];

  _hlSections = sections;

  if (!sections.length) {
    list.innerHTML = '<div class="hl-rail-empty">No sections yet</div>';
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

  // Progress indicator
  var progressEl = document.getElementById('hl-progress');
  var partNames = ['Lead', 'High', 'Low'];

  // If no harmony data yet, show default part cards
  if (!singers.length) {
    var defaultParts = [
      { name: 'Lead',         role: 'lead',  icon: '🎤', singer: '—', hasData: false },
      { name: 'High Harmony', role: 'high',  icon: '⬆️', singer: '—', hasData: false },
      { name: 'Low Harmony',  role: 'low',   icon: '⬇️', singer: '—', hasData: false },
    ];
    grid.innerHTML = defaultParts.map(_hlPartCardHTML).join('');
    if (practiceGrid) practiceGrid.innerHTML = grid.innerHTML;
    if (progressEl) progressEl.textContent = 'Start with Lead';
    return;
  }

  var cards = singers.map(function(singer, i) {
    var roles = ['lead','high','mid','low'];
    return _hlPartCardHTML({
      name:   singer.charAt(0).toUpperCase() + singer.slice(1),
      role:   roles[i] || 'optional',
      icon:   i === 0 ? '🎤' : i === 1 ? '⬆️' : '⬇️',
      singer: singer,
      hasData: true,
    });
  }).join('');

  grid.innerHTML = cards;
  if (practiceGrid) practiceGrid.innerHTML = cards;

  // Update progress
  if (progressEl) {
    var ready = Math.min(singers.length, 3);
    if (ready >= 3) {
      progressEl.innerHTML = '<span style="color:#10b981">All parts ready</span>';
    } else if (ready === 2) {
      progressEl.innerHTML = 'Next: <span style="color:#818cf8">Add Low</span>';
    } else if (ready === 1) {
      progressEl.innerHTML = 'Next: <span style="color:#818cf8">Add High</span>';
    } else {
      progressEl.textContent = 'Start with Lead';
    }
  }
}

function _hlPartCardHTML(part) {
  var roleColors = { lead:'#667eea', high:'#10b981', mid:'#f59e0b', low:'#ec4899', optional:'#64748b' };
  var color = roleColors[part.role] || '#667eea';
  var isLead = part.role === 'lead';
  var hasData = part.hasData !== false;
  var cardPad = '16px';
  var cardStyle = isLead
    ? 'border:2px solid ' + color + ';background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03));padding:' + cardPad + ';box-shadow:0 0 20px rgba(99,102,241,0.08)'
    : 'border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);padding:' + cardPad;
  var genPulse = (isLead && !hasData) ? ' hl-pulse-glow' : '';
  var actions = '';
  if (hasData) {
    actions = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">'
            + '<button class="hl-part-guide-btn" style="width:100%;text-align:center;padding:8px" onclick="hlPlayGuide(\'' + _hlEsc(part.singer) + '\')">▶ Play</button>'
            + '<button class="hl-part-gen-btn" style="width:100%;text-align:center;padding:8px;background:rgba(255,255,255,0.04);color:var(--text-muted,#94a3b8)" onclick="hlShowGenerateGuide(\'' + _hlEsc(part.singer) + '\',\'' + _hlEsc(part.role) + '\')">✏️ Edit</button>'
            + '</div>';
  } else {
    actions = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">'
            + '<button class="hl-part-gen-btn' + genPulse + '" style="width:100%;text-align:center;padding:8px" onclick="hlShowGenerateGuide(\'' + _hlEsc(part.singer) + '\',\'' + _hlEsc(part.role) + '\')">✨ Generate</button>'
            + '<button class="hl-part-guide-btn" style="width:100%;text-align:center;padding:8px;background:rgba(255,255,255,0.05);color:var(--text,#cbd5e1);border-color:rgba(255,255,255,0.12)" onclick="hlSwitchMode(\'record\')">⏺ Record</button>'
            + '</div>';
  }
  var microcopy = isLead && !hasData ? '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin-top:4px">Start here — generate or record your lead</div>' : '';
  return [
    '<div class="hl-part-card" style="border-radius:12px;' + cardStyle + '">',
    '  <div style="display:flex;align-items:center;gap:12px">',
    '    <div style="font-size:1.4em;width:32px;text-align:center;flex-shrink:0">' + part.icon + '</div>',
    '    <div style="flex:1">',
    '      <div style="font-weight:700;font-size:' + (isLead ? '1em' : '0.88em') + ';color:var(--text,#f1f5f9)">' + _hlEsc(part.name) + '</div>',
    '      <div style="font-size:0.7em;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.05em">' + _hlEsc(part.role.toUpperCase()) + '</div>',
    microcopy,
    '    </div>',
    '    <div style="font-size:0.78em;color:var(--text-dim,#475569)">' + _hlEsc(part.singer) + '</div>',
    '  </div>',
    actions,
    '</div>',
  ].join('');
}

// ── Session 1B: AI Guide Harmony Generator ───────────────────────────────────

var _hlNoteToHz = {
  'C2':65.41,'C#2':69.30,'D2':73.42,'D#2':77.78,'E2':82.41,'F2':87.31,'F#2':92.50,'G2':98.00,'G#2':103.83,'A2':110.00,'A#2':116.54,'B2':123.47,
  'C3':130.81,'C#3':138.59,'D3':146.83,'D#3':155.56,'E3':164.81,'F3':174.61,'F#3':185.00,'G3':196.00,'G#3':207.65,'A3':220.00,'A#3':233.08,'B3':246.94,
  'C4':261.63,'C#4':277.18,'D4':293.66,'D#4':311.13,'E4':329.63,'F4':349.23,'F#4':369.99,'G4':392.00,'G#4':415.30,'A4':440.00,'A#4':466.16,'B4':493.88,
  'C5':523.25,'C#5':554.37,'D5':587.33,'D#5':622.25,'E5':659.25,'F5':698.46,'F#5':739.99,'G5':783.99,'G#5':830.61,'A5':880.00,'A#5':932.33,'B5':987.77,
  'C6':1046.50,'REST':0
};

// Stem-based extraction (Demucs vocals → LALAL.AI lead/backing → harmonies_data).
// Skips the AI synth modal entirely. Result: a Lead audio track + Backing audio
// track playable in the Harmony Lab mixer with mute/solo/pan/loop. No notation
// transcription yet — that's a future Basic Pitch pass on each split stem.
window.hlGenerateFromStems = async function hlGenerateFromStems() {
  var song = _hlSong;
  if (!song) { if (typeof showToast === 'function') showToast('No song selected'); return; }
  if (!window.GLStems || !GLStems.splitLeadBacking) {
    if (typeof showToast === 'function') showToast('Stems engine not loaded');
    return;
  }

  // Closes the synth modal if it's open
  var existing = document.getElementById('hl-gen-modal');
  if (existing) existing.remove();

  // Status overlay so user knows what's happening (LALAL takes ~30-60s)
  var overlay = document.createElement('div');
  overlay.id = 'hl-stems-extract-modal';
  overlay.className = 'hl-gen-modal-overlay';
  overlay.innerHTML = '<div class="hl-gen-modal" style="max-width:420px">'
    + '<div class="hl-gen-modal-title">🎤 Extracting Harmonies</div>'
    + '<div id="hl-extract-status" style="margin:14px 0;font-size:0.88em;color:var(--text);line-height:1.5">Looking up Demucs stems…</div>'
    + '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:10px">'
    + '  <div id="hl-extract-bar" style="height:100%;width:10%;background:linear-gradient(90deg,#667eea,#764ba2);transition:width 0.4s ease"></div>'
    + '</div>'
    + '<div id="hl-extract-detail" style="font-size:0.72em;color:var(--text-dim);line-height:1.5">First-time runs may take 30–60 seconds.</div>'
    + '<div class="hl-gen-actions" style="margin-top:14px">'
    + '<button id="hl-extract-cancel" class="btn btn-sm" onclick="document.getElementById(\'hl-stems-extract-modal\').remove()">Hide</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  var statusEl = document.getElementById('hl-extract-status');
  var barEl = document.getElementById('hl-extract-bar');
  var detailEl = document.getElementById('hl-extract-detail');
  function setStatus(msg, pct, detail) {
    if (statusEl) statusEl.textContent = msg;
    if (barEl && typeof pct === 'number') barEl.style.width = pct + '%';
    if (detailEl && detail) detailEl.textContent = detail;
  }

  try {
    setStatus('Looking up Demucs stems…', 15);
    var demucs = await GLStems.getStems(song);
    var vocalsUrl = demucs && demucs.stems && demucs.stems.vocals;
    if (!vocalsUrl) {
      setStatus('No Demucs vocals stem found.', 0, 'Run Stems separation first, then come back here.');
      var c = document.getElementById('hl-extract-cancel');
      if (c) c.textContent = 'Close';
      return;
    }

    setStatus('Uploading vocals to LALAL…', 25,
      'Stage 1: uploading + submitting the split job (~10-30s).');

    var split = await GLStems.splitLeadBacking(song, {
      sourceUrl: vocalsUrl,
      sourceLabel: 'Demucs vocals stem',
      onProgress: function(stage, percent) {
        if (stage === 'starting') {
          setStatus('Uploading vocals to LALAL…', 25,
            'Stage 1: uploading + submitting the split job (~10-30s).');
        } else if (stage === 'processing') {
          // LALAL progress 0-100 maps to overall 30-75
          var overall = 30 + Math.min(45, Math.max(0, Math.round(percent * 0.45)));
          setStatus('Splitting vocals into lead + backing… ' + percent + '%', overall,
            'Stage 2: LALAL.AI is processing. Polling every 5s.');
        } else if (stage === 'finalizing') {
          setStatus('Downloading + saving stems…', 78,
            'Stage 3: re-hosting lead + backing audio.');
        }
      }
    });

    if (!split || !split.stems || !split.stems.lead) {
      throw new Error('LALAL returned no lead stem');
    }

    setStatus('Saving harmony parts…', 80);

    // Build harmonies_data the Harmony Lab mixer reads. Each part with an
    // audio_url renders as a row with mute/solo/pan/volume controls.
    var harmoniesData = {
      sections: [{
        name: 'Full Song',
        parts: [
          { singer: 'Lead', part: 'lead', source: 'lalal', audio_url: split.stems.lead, notes: null, notation_quality: '' },
          { singer: 'Backing', part: 'backing', source: 'lalal', audio_url: split.stems.backing, notes: null, notation_quality: '' }
        ]
      }],
      generatedAt: new Date().toISOString(),
      source: 'demucs+lalal',
      lalal_task_id: split.lalal_task_id || null
    };

    if (typeof saveBandDataToDrive === 'function') {
      await saveBandDataToDrive(song, 'harmonies_data', harmoniesData);
    }

    setStatus('Done — refreshing Harmony Lab…', 100);

    // Reload harmony lab UI so the split mixer renders with the new parts
    if (typeof _hlLoadData === 'function') {
      try { await _hlLoadData(song); } catch(e) {}
    }

    if (typeof showToast === 'function') showToast('✅ Harmonies extracted from Demucs vocals stem');
    setTimeout(function() {
      var m = document.getElementById('hl-stems-extract-modal');
      if (m) m.remove();
    }, 800);
  } catch (e) {
    console.error('[HarmonyLab] hlGenerateFromStems failed:', e);
    setStatus('Failed: ' + (e && e.message ? e.message : 'unknown error'), 0,
      'Check the Cloudflare Worker logs for /lalal/split if this keeps happening.');
    var c2 = document.getElementById('hl-extract-cancel');
    if (c2) c2.textContent = 'Close';
  }
};

window.hlShowGenerateGuide = async function hlShowGenerateGuide(singer, role) {
  var existing = document.getElementById('hl-gen-modal');
  if (existing) existing.remove();

  // If we have a Demucs vocals stem for this song, prefer the real
  // stem-based extraction over the AI synth. Show a chooser so the user
  // can still fall back to synth if they want a designed harmony rather
  // than what the actual recording sang.
  try {
    if (_hlSong && window.GLStems && GLStems.getStems) {
      var demucs = await GLStems.getStems(_hlSong);
      var hasVocals = !!(demucs && demucs.stems && demucs.stems.vocals);
      if (hasVocals) {
        var chooser = document.createElement('div');
        chooser.id = 'hl-gen-modal';
        chooser.className = 'hl-gen-modal-overlay';
        chooser.innerHTML = '<div class="hl-gen-modal" style="max-width:460px">'
          + '<div class="hl-gen-modal-title">✨ Generate Harmony</div>'
          + '<div class="hl-gen-modal-sub" style="margin-bottom:14px">You have a Demucs vocals stem — pick how to generate harmonies:</div>'
          + '<div style="display:flex;flex-direction:column;gap:10px">'
          + '<button onclick="document.getElementById(\'hl-gen-modal\').remove();hlGenerateFromStems()" style="text-align:left;padding:14px;border-radius:10px;border:1px solid rgba(99,102,241,0.35);background:rgba(99,102,241,0.08);color:var(--text);cursor:pointer">'
          + '<div style="font-weight:700;font-size:0.92em;margin-bottom:4px">🎤 Use Demucs vocals (recommended)</div>'
          + '<div style="font-size:0.78em;color:var(--text-dim);line-height:1.4">Sends your existing vocals stem to LALAL.AI to split lead from backing. ~30–60s. Result: real audio of each harmony part.</div>'
          + '</button>'
          + '<button onclick="document.getElementById(\'hl-gen-modal\').remove();hlShowGenerateGuideSynth(\'' + _hlEsc(singer) + '\',\'' + _hlEsc(role) + '\')" style="text-align:left;padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.02);color:var(--text);cursor:pointer">'
          + '<div style="font-weight:700;font-size:0.92em;margin-bottom:4px">🤖 Synthesize with AI</div>'
          + '<div style="font-size:0.78em;color:var(--text-dim);line-height:1.4">Composes a designed harmony line from key + chord progression (Claude). Doesn\'t use your stems — useful for arranging new parts.</div>'
          + '</button>'
          + '</div>'
          + '<div class="hl-gen-actions" style="margin-top:14px">'
          + '<button class="btn btn-sm" onclick="document.getElementById(\'hl-gen-modal\').remove()">Cancel</button>'
          + '</div></div>';
        document.body.appendChild(chooser);
        return;
      }
    }
  } catch(e) { /* fall through to synth modal */ }

  // No Demucs stems available — show synth modal directly
  hlShowGenerateGuideSynth(singer, role);
};

// Original synth modal — split out so the chooser above can route to it.
window.hlShowGenerateGuideSynth = function hlShowGenerateGuideSynth(singer, role) {
  var existing = document.getElementById('hl-gen-modal');
  if (existing) existing.remove();

  var key = _hlGetSongKey() || 'G';
  var bpm = _hlGetSongBpm() || 120;

  var modal = document.createElement('div');
  modal.id = 'hl-gen-modal';
  modal.className = 'hl-gen-modal-overlay';
  modal.innerHTML = '<div class="hl-gen-modal">'
    + '<div class="hl-gen-modal-title">✨ Generate Guide Harmony</div>'
    + '<div class="hl-gen-modal-sub">For: ' + _hlEsc(singer) + ' (' + _hlEsc(role) + ')</div>'
    + '<div style="margin:8px 0 12px;padding:8px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;font-size:0.72em;color:#fbbf24;line-height:1.4">⚠ This composes a synthesized guide from chords + key (AI-generated). It does <b>not</b> use your Demucs stems — extracting harmonies from the actual vocals stem is a separate (in-progress) feature.</div>'
    + '<div class="hl-gen-field"><label>Key</label>'
    + '<input id="hl-gen-key" class="hl-import-input" type="text" value="' + _hlEsc(key) + '" style="width:60px"></div>'
    + '<div class="hl-gen-field"><label>BPM</label>'
    + '<input id="hl-gen-bpm" class="hl-import-input" type="number" value="' + bpm + '" style="width:70px"></div>'
    + '<div class="hl-gen-field"><label>Chord Progression</label>'
    + '<input id="hl-gen-chords" class="hl-import-input" type="text" placeholder="e.g. I IV V I or G C D G" style="width:100%"></div>'
    + '<div class="hl-gen-field"><label>Beats</label>'
    + '<input id="hl-gen-beats" class="hl-import-input" type="number" value="16" style="width:70px"></div>'
    + '<div class="hl-gen-field"><label>Recipe</label>'
    + '<select id="hl-gen-recipe" class="hl-import-input">'
    + '<option value="high_third">High Third</option>'
    + '<option value="low_third">Low Third</option>'
    + '<option value="fifth">Fifth</option>'
    + '</select></div>'
    + '<div id="hl-gen-status" class="hl-gen-status"></div>'
    + '<div class="hl-gen-actions">'
    + '<button class="btn btn-sm btn-primary" onclick="hlGenerateGuide(\'' + _hlEsc(singer) + '\',\'' + _hlEsc(role) + '\')">Generate</button>'
    + '<button class="btn btn-sm" onclick="document.getElementById(\'hl-gen-modal\').remove()">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(modal);
};

window.hlGenerateGuide = async function hlGenerateGuide(singer, role) {
  var statusEl = document.getElementById('hl-gen-status');
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  var key    = (document.getElementById('hl-gen-key')     || {}).value || 'G';
  var bpm    = parseInt((document.getElementById('hl-gen-bpm')    || {}).value) || 120;
  var chords = (document.getElementById('hl-gen-chords')  || {}).value || 'I IV V I';
  var beats  = parseInt((document.getElementById('hl-gen-beats')  || {}).value) || 16;
  var recipe = (document.getElementById('hl-gen-recipe')  || {}).value || 'high_third';

  setStatus('Asking Claude for note sequence...');

  var prompt = 'You are a music theory assistant. Generate a harmony guide track note sequence.'
    + ' Key: ' + key + '. BPM: ' + bpm + '. Chord progression: ' + chords + '.'
    + ' Recipe: ' + recipe + ' (high_third = sing a major or minor third above the melody; low_third = third below; fifth = fifth above).'
    + ' Total beats: ' + beats + '.'
    + ' Respond ONLY with a valid JSON array, no markdown, no code fences, no explanation.'
    + ' Each element: {"beat": 1, "note": "G4", "durationBeats": 2}'
    + ' Use standard note names like C4, D#4, Bb3. Use "REST" for silence.'
    + ' Notes should form a smooth singable harmony line for a ' + role + ' voice.';

  var noteSequence;
  try {
    var fetchRes = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var res = await fetchRes.json();
    var text = res && res.content && res.content[0] && res.content[0].text;
    if (!text) throw new Error('No response from Claude');
    var clean = text.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
    noteSequence = JSON.parse(clean);
    if (!Array.isArray(noteSequence)) throw new Error('Response was not a JSON array');
  } catch(e) {
    setStatus('Generation failed: ' + e.message);
    return;
  }

  setStatus('Rendering audio (' + noteSequence.length + ' notes)...');

  var audioDataUri;
  try {
    audioDataUri = await _hlRenderNoteSequence(noteSequence, bpm);
  } catch(e) {
    setStatus('Audio render failed: ' + e.message);
    return;
  }

  setStatus('Saving...');

  var label = recipe.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) + ' — ' + singer;
  var asset = {
    label: label,
    url: audioDataUri,
    part: role,
    source: 'generated',
    singer: singer,
    recipe: recipe,
    key: key,
    bpm: bpm,
    mimeType: 'audio/wav'
  };

  try {
    await _hlSaveAsset(_hlSong, asset);
    _hlAssets = await _hlLoadAssets(_hlSong);
    _hlRenderAssetPlayer(_hlAssets);
    var modal = document.getElementById('hl-gen-modal');
    if (modal) modal.remove();
    if (typeof showToast === 'function') {
      var roleLabel = (asset.label || '').toLowerCase();
      if (roleLabel.includes('lead')) showToast('Lead created. Now add harmony parts.', 3000);
      else if (roleLabel.includes('high')) showToast('High harmony added. One more to go!', 3000);
      else if (roleLabel.includes('low')) showToast('All parts created!', 3000);
      else showToast('Harmony part generated and saved', 3000);
    }
  } catch(e) {
    setStatus('Save failed: ' + e.message);
  }
};

async function _hlRenderNoteSequence(noteSequence, bpm) {
  var beatsPerSec = bpm / 60;
  var totalBeats = noteSequence.reduce(function(max, n) {
    return Math.max(max, ((n.beat || 1) - 1) + (n.durationBeats || 1));
  }, 0);
  var totalSecs = Math.max(totalBeats / beatsPerSec, 1);
  var sampleRate = 44100;
  var numSamples = Math.ceil(totalSecs * sampleRate);
  var buffer = new Float32Array(numSamples);

  noteSequence.forEach(function(n) {
    var freq = _hlNoteToHz[n.note] || 0;
    if (!freq) return;
    var startSample = Math.floor(((n.beat - 1) / beatsPerSec) * sampleRate);
    var durSamples  = Math.floor((n.durationBeats / beatsPerSec) * sampleRate);
    var fadeLen = Math.min(200, Math.floor(durSamples * 0.1));
    for (var i = 0; i < durSamples && (startSample + i) < numSamples; i++) {
      var t = i / sampleRate;
      var sample = Math.sin(2 * Math.PI * freq * t) * 0.6
                 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.2
                 + Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
      var env = 1;
      if (i < fadeLen) env = i / fadeLen;
      else if (i > durSamples - fadeLen) env = (durSamples - i) / fadeLen;
      buffer[startSample + i] += sample * env * 0.4;
    }
  });

  var wavBytes = _hlEncodeWav(buffer, sampleRate);
  var blob = new Blob([wavBytes], { type: 'audio/wav' });
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function _hlEncodeWav(samples, sampleRate) {
  var len = samples.length;
  var buf = new ArrayBuffer(44 + len * 2);
  var view = new DataView(buf);
  function writeStr(off, str) { for (var i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
  writeStr(0, 'RIFF');
  view.setUint32(4,  36 + len * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);
  view.setUint16(22, 1,  true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2,  true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, len * 2, true);
  for (var i = 0; i < len; i++) {
    var s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7FFF, true);
  }
  return buf;
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
  var asset = _hlAssets.find(function(a) {
    return a.singer === singer || a.label === singer || a.part === 'guide';
  }) || _hlAssets.find(function(a) {
    return a.part === 'high' || a.part === 'lead';
  });

  if (!asset || !asset.url) {
    if (typeof showToast === 'function') showToast('No guide track for ' + singer + ' — import one below');
    var imp = document.getElementById('hl-import-panel');
    if (imp) imp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (_hlCurrentAudio) { _hlCurrentAudio.pause(); _hlCurrentAudio.currentTime = 0; }
  _hlCurrentAudio = new Audio(asset.url);
  // Stab #07 — assert single-owner playback before the take-review element
  // takes the floor. Self-skip via 'harmony-lab' so the split mixer is paused
  // when a take is auditioned.
  try {
    if (window.GLPlayerContract && typeof window.GLPlayerContract.pauseAll === 'function') {
      window.GLPlayerContract.pauseAll('harmony-lab');
    }
  } catch (e) {}
  _hlCurrentAudio.play().catch(function(e) {
    if (typeof showToast === 'function') showToast('Playback failed: ' + e.message);
  });
  if (typeof showToast === 'function') showToast('Playing: ' + (asset.label || singer));
};

window.hlImportAssetFromUrl = async function hlImportAssetFromUrl() {
  var input = document.getElementById('hl-import-url-input');
  var url = input ? input.value.trim() : '';
  if (!url) { if (typeof showToast === 'function') showToast('Paste a URL first'); return; }

  // Validate — block known non-direct URLs with clear messaging
  var validationError = _hlValidateAudioUrl(url);
  if (validationError) {
    if (typeof showToast === 'function') showToast(validationError);
    var errEl = document.getElementById('hl-url-error');
    if (errEl) { errEl.textContent = validationError; errEl.style.display = 'block'; }
    return;
  }
  var errEl2 = document.getElementById('hl-url-error');
  if (errEl2) errEl2.style.display = 'none';

  var labelEl = document.getElementById('hl-import-label-input');
  var label = labelEl ? labelEl.value.trim() : '';
  if (!label) label = _hlSmartLabel(url);

  var mimeMatch = url.match(/\.(mp3|wav|ogg|m4a|flac|aac)/i);
  var asset = { label: label, url: url, part: 'guide', source: 'url',
    mimeType: mimeMatch ? 'audio/' + mimeMatch[1].toLowerCase() : 'audio/mpeg' };
  try {
    var btn = document.getElementById('hl-import-url-btn');
    if (btn) btn.textContent = 'Saving...';
    await _hlSaveAsset(_hlSong, asset);
    _hlAssets = await _hlLoadAssets(_hlSong);
    _hlRenderAssetPlayer(_hlAssets);
    if (input) input.value = '';
    if (labelEl) labelEl.value = '';
    if (typeof showToast === 'function') showToast('Guide track saved');
    if (btn) btn.textContent = 'Import';
  } catch(e) {
    if (typeof showToast === 'function') showToast('Save failed: ' + e.message);
    var btn2 = document.getElementById('hl-import-url-btn');
    if (btn2) btn2.textContent = 'Import';
  }
};

window.hlImportAssetFromFile = function hlImportAssetFromFile(inputOrFile) {
  var file = (inputOrFile && inputOrFile.files) ? inputOrFile.files[0] : inputOrFile;
  if (!file) return;

  var MB20 = 20 * 1024 * 1024;
  var MB10 = 10 * 1024 * 1024;

  if (file.size > MB20) {
    // Future hook: offer Chopper for oversized files
    if (typeof showToast === 'function') showToast('File too large (>' + Math.round(file.size/1024/1024) + 'MB). Max 20MB. Try trimming with the Chopper first.');
    return;
  }
  if (file.size > MB10) {
    if (typeof showToast === 'function') showToast('Large file (' + Math.round(file.size/1024/1024) + 'MB) — upload may be slow...');
  } else {
    if (typeof showToast === 'function') showToast('Uploading ' + file.name + '...');
  }

  // Clean label from filename
  var cleanLabel = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (cleanLabel.length > 40) cleanLabel = cleanLabel.slice(0, 40) + '…';

  var reader = new FileReader();
  reader.onload = async function(e) {
    var asset = { label: cleanLabel, url: e.target.result,
      part: 'guide', source: 'imported', mimeType: file.type || 'audio/mpeg' };
    try {
      await _hlSaveAsset(_hlSong, asset);
      _hlAssets = await _hlLoadAssets(_hlSong);
      _hlRenderAssetPlayer(_hlAssets);
      if (typeof showToast === 'function') showToast(cleanLabel + ' imported');
    } catch(err) {
      if (typeof showToast === 'function') showToast('Import failed: ' + err.message);
    }
  };
  reader.readAsDataURL(file);
};

window.hlHandleImportDrop = function hlHandleImportDrop(event) {
  event.preventDefault();
  var panel = document.getElementById('hl-import-panel');
  if (panel) panel.classList.remove('hl-import-drag');
  var files = event.dataTransfer && event.dataTransfer.files;
  if (!files || !files.length) return;
  var file = files[0];
  if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i)) {
    if (typeof showToast === 'function') showToast('Please drop an audio file (mp3, wav, ogg, m4a)');
    return;
  }
  hlImportAssetFromFile(file);
};

window.hlDeleteAsset = async function hlDeleteAsset(assetKey) {
  var songKey = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(_hlSong) : _hlSong;
  if (!assetKey) {
    // Orphan with no key — re-render from fresh load to clear display
    _hlAssets = await _hlLoadAssets(_hlSong);
    _hlRenderAssetPlayer(_hlAssets);
    if (typeof showToast === 'function') showToast('Refreshed track list');
    return;
  }
  try {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) throw new Error('No Firebase');
    await firebaseDB.ref(bandPath('songs/' + songKey + '/harmony_assets/' + assetKey)).remove();
    _hlAssets = await _hlLoadAssets(_hlSong);
    _hlRenderAssetPlayer(_hlAssets);
    if (typeof showToast === 'function') showToast('Deleted');
  } catch(e) {
    console.warn('[HarmonyLab] delete failed:', e);
    if (typeof showToast === 'function') showToast('Delete failed: ' + e.message);
  }
};

function _hlRenderAssetPlayer(assets) {
  var container = document.getElementById('hl-asset-player');
  if (!container) return;
  if (!assets || !assets.length) {
    container.innerHTML = '<div class="hl-asset-empty">No guide tracks yet — import one below</div>';
    return;
  }
  container.innerHTML = assets.map(function(a) {
    var key = a._key || '';
    var label = a.label || _hlSmartLabel(a.url) || 'Track';
    return '<div class="hl-asset-row">'
      + '<span class="hl-asset-label" title="Click to rename" onclick="hlRenameAsset(\'' + (key||'').replace(/'/g,'') + '\',this)">' + _hlEsc(label) + '</span>'
      + '<audio class="hl-asset-audio" src="' + _hlEsc(a.url || '') + '" controls preload="none"></audio>'
      + '<button class="hl-asset-del" onclick="hlDeleteAsset(\'' + (key||'').replace(/'/g,'') + '\')" title="Delete">🗑</button>'
      + '</div>';
  }).join('');
}

window.hlRenameAsset = async function hlRenameAsset(assetKey, el) {
  if (!assetKey || !el) return;
  var current = el.textContent.replace(/…$/, '');
  var newLabel = window.prompt('Rename track:', current);
  if (!newLabel || newLabel.trim() === current) return;
  newLabel = newLabel.trim().slice(0, 60);
  try {
    var songKey = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(_hlSong) : _hlSong;
    await firebaseDB.ref(bandPath('songs/' + songKey + '/harmony_assets/' + assetKey + '/label')).set(newLabel);
    _hlAssets = await _hlLoadAssets(_hlSong);
    _hlRenderAssetPlayer(_hlAssets);
  } catch(e) {
    if (typeof showToast === 'function') showToast('Rename failed: ' + e.message);
  }
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
  // Prefer DOM input (user may have edited but not saved); fall back to the
  // song-detail stash so we still get real values when the inputs aren't
  // mounted in the current view.
  var sel = document.getElementById('sd-songKeySelect') || document.getElementById('songKeySelect');
  if (sel && sel.value) return sel.value;
  try { if (window._sdCurrentSongMeta && window._sdCurrentSongMeta.key) return window._sdCurrentSongMeta.key; } catch(e) {}
  return '';
}
function _hlGetSongBpm() {
  var inp = document.getElementById('sd-songBpmInput') || document.getElementById('songBpmInput');
  var v = inp ? parseInt(inp.value) : 0;
  if (v && !isNaN(v)) return v;
  try {
    var b = window._sdCurrentSongMeta && parseInt(window._sdCurrentSongMeta.bpm);
    if (b && !isNaN(b)) return b;
  } catch(e) {}
  return null;
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
@keyframes hlPulseGlow {
  0%, 100% { box-shadow: 0 0 4px rgba(99,102,241,0.15); }
  50% { box-shadow: 0 0 12px rgba(99,102,241,0.3); }
}
.hl-pulse-glow { animation: hlPulseGlow 3s ease-in-out infinite; }
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
.hl-part-gen-btn { margin-top: 4px; width: 100%; padding: 5px 0; border-radius: 7px; font-size: 0.72em; font-weight: 700; border: 1px solid rgba(102,126,234,0.3); background: rgba(102,126,234,0.08); color: #818cf8; cursor: pointer; transition: all 0.12s; }
.hl-part-gen-btn:hover { background: rgba(102,126,234,0.2); border-color: rgba(102,126,234,0.5); color: #a5b4fc; }
.hl-gen-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; }
.hl-gen-modal { background: var(--surface, #1e293b); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 24px; width: 100%; max-width: 420px; }
.hl-gen-modal-title { font-size: 1.1em; font-weight: 800; color: var(--text, #f1f5f9); margin-bottom: 4px; }
.hl-gen-modal-sub { font-size: 0.82em; color: var(--text-muted, #94a3b8); margin-bottom: 16px; }
.hl-gen-field { margin-bottom: 12px; }
.hl-gen-field label { display: block; font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim, #64748b); margin-bottom: 4px; }
.hl-gen-status { font-size: 0.82em; color: #818cf8; min-height: 18px; margin-bottom: 10px; font-style: italic; }
.hl-gen-actions { display: flex; gap: 8px; margin-top: 4px; }
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

/* Asset player */
.hl-asset-player { margin: 8px 0 4px; }
.hl-url-error { font-size: 0.8em; color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; padding: 6px 10px; margin: 4px 0; white-space: pre-line; line-height: 1.4; }
.hl-import-drag { border-color: rgba(102,126,234,0.6) !important; background: rgba(102,126,234,0.07) !important; }
.hl-asset-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.hl-asset-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted,#94a3b8); min-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hl-asset-audio { flex: 1; height: 28px; min-width: 0; }
.hl-asset-del { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9em; padding: 2px 4px; flex-shrink: 0; }
.hl-asset-del:hover { color: #ef4444; }
.hl-asset-empty { font-size: 0.82em; color: var(--text-dim,#64748b); padding: 6px 0; font-style: italic; }
/* Import panel */
.hl-import-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
.hl-import-title { font-size: 0.78em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim,#64748b); margin-bottom: 10px; }
.hl-import-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hl-import-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: var(--text,#f1f5f9); padding: 6px 10px; font-size: 0.82em; outline: none; }
.hl-import-input:focus { border-color: rgba(102,126,234,0.5); }
.hl-import-file-label { font-size: 0.82em; color: var(--text-muted,#94a3b8); cursor: pointer; padding: 6px 10px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 7px; display: inline-block; }
.hl-import-file-label:hover { border-color: rgba(102,126,234,0.4); color: #818cf8; }
.hl-section-title { font-size: 0.78em; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-dim,#64748b); margin-bottom: 6px; }
/* Split mixer (Phase 1.6) */
.hl-mix-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; }
.hl-mix-card-title { font-size: 0.82em; font-weight: 800; color: var(--text, #f1f5f9); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.hl-mix-subtitle { font-size: 0.72em; font-weight: 600; color: var(--text-dim, #64748b); }
.hl-mix-transport { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.hl-mix-transport button { background: rgba(102,126,234,0.18); color: #a5b4fc; border: 1px solid rgba(102,126,234,0.35); padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; min-width: 80px; }
.hl-mix-transport button:hover { background: rgba(102,126,234,0.28); }
.hl-mix-time { font-size: 0.78em; color: var(--text-dim, #64748b); font-variant-numeric: tabular-nums; min-width: 80px; text-align: right; }
.hl-mix-loop { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; padding: 8px 10px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.78em; color: var(--text-muted, #94a3b8); }
.hl-mix-loop label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 700; }
.hl-mix-loop-fields { display: flex; align-items: center; gap: 4px; }
.hl-mix-loop-hint { font-size: 0.72em; color: var(--text-dim, #64748b); margin-left: auto; }
.hl-mix-row { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; background: rgba(255,255,255,0.02); margin-bottom: 8px; }
.hl-mix-row button { padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: var(--text-dim, #64748b); cursor: pointer; font-size: 0.72em; font-weight: 700; min-width: 46px; flex-shrink: 0; }
.hl-mix-row button:hover { background: rgba(255,255,255,0.08); color: var(--text, #f1f5f9); }
.hl-mix-row .hl-mix-mute.hl-mix-btn-on { background: rgba(239,68,68,0.18); color: #fca5a5; border-color: rgba(239,68,68,0.35); }
.hl-mix-row .hl-mix-solo.hl-mix-btn-on { background: rgba(245,158,11,0.18); color: #fbbf24; border-color: rgba(245,158,11,0.35); }
.hl-mix-row audio { display: none; }
.hl-mix-badge { font-size: 0.62em; font-weight: 800; padding: 1px 6px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }

/* ABC notation render */
.hl-abc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.hl-abc-quality { font-size: 0.62em; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em; }

/* Utilities */
.hl-hidden { display: none !important; }
  `;
  document.head.appendChild(s);
}

console.log('✅ harmony-lab.js loaded');
