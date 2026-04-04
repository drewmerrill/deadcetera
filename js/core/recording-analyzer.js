// ============================================================================
// js/core/recording-analyzer.js — Unified "Analyze Recording" Workflow
//
// Wires together existing audio analysis capabilities into a single flow:
//   1. Decode audio file (MP3/WAV)
//   2. Run Rehearsal Segmentation Engine (detect segments)
//   3. Run Pocket Meter OfflineAnalyser (BPM + groove per segment)
//   4. Attempt song matching against band catalog
//   5. Present draft segments for user review
//   6. Feed confirmed segments into RehearsalAnalysis pipeline
//
// DEPENDS ON:
//   - RehearsalSegmentationEngine (rehearsal_segmentation_engine.js)
//   - PocketMeter OfflineAnalyser (pocket-meter.js)
//   - RehearsalAnalysis (rehearsal-analysis-pipeline.js)
//   - GLStore (groovelinx_store.js)
//   - allSongs (data.js / firebase-service.js)
//
// EXPOSES:
//   RecordingAnalyzer.analyze(file, opts)
//   RecordingAnalyzer.showUI(sessionId, mixdownId)
//   RecordingAnalyzer.confirmAndGenerate(sessionId, segments)
// ============================================================================

'use strict';

window.RecordingAnalyzer = (function() {

  var _audioCtx = null;
  var _currentSegments = null;
  var _currentSessionId = null;
  var _currentAudioBuffer = null;

  // ── Main Analysis Flow ──────────────────────────────────────────────────────

  /**
   * Analyze an audio file end-to-end.
   * @param {File|ArrayBuffer} source - MP3/WAV file or raw bytes
   * @param {object} opts
   *   - sessionId: string (Firebase session ID to attach results to)
   *   - targetBPM: number (default 120)
   *   - onProgress: function(stage, pct) — progress callback
   * @returns {Promise<object>} { segments, grooveMetrics, duration, songMatches }
   */
  // Max file size for full decode (100MB) — larger files use downsampled path
  var _MAX_FULL_DECODE_BYTES = 100 * 1024 * 1024;
  // Downsample rate for large files — 22050 Hz mono = 1/4 memory of 44100 stereo
  var _DOWNSAMPLE_RATE = 22050;

  async function analyze(source, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function() {};

    // Stage 1: Decode audio (memory-safe for large files)
    onProgress('decoding', 0);
    var arrayBuffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
    var fileSize = arrayBuffer.byteLength;
    var isLargeFile = fileSize > _MAX_FULL_DECODE_BYTES;

    console.log('[RecordingAnalyzer] File size: ' + Math.round(fileSize / 1024 / 1024) + 'MB' + (isLargeFile ? ' (large file mode)' : ''));

    var channelData, sampleRate, duration;

    if (isLargeFile) {
      // Large file: decode in chunks to avoid OOM crash
      // Strategy: decode small slices, extract RMS energy, build a lightweight
      // energy timeline that the segmentation engine can process
      try {
        var CHUNK_DURATION = 30; // seconds per chunk
        var tempCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Decode first 2MB to estimate bitrate and duration
        var probeSize = Math.min(arrayBuffer.byteLength, 2 * 1024 * 1024);
        var probeBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0, probeSize));
        var bitrate = (probeSize * 8) / probeBuffer.duration;
        var estDuration = (arrayBuffer.byteLength * 8) / bitrate;
        var probeSR = probeBuffer.sampleRate;
        onProgress('decoding', 10);

        // Build downsampled mono channel from chunks
        // Target: 1 sample per 100ms = 10 Hz effective rate (tiny memory footprint)
        var RMS_WINDOW_SEC = 0.1; // 100ms windows
        var rmsTimeline = [];
        var chunkBytes = Math.ceil(bitrate * CHUNK_DURATION / 8);
        var totalChunks = Math.ceil(arrayBuffer.byteLength / chunkBytes);

        for (var ci = 0; ci < totalChunks; ci++) {
          var start = ci * chunkBytes;
          var end = Math.min(start + chunkBytes + 4096, arrayBuffer.byteLength); // overlap for decoder
          try {
            var chunkAudio = await tempCtx.decodeAudioData(arrayBuffer.slice(start, end));
            var chunkSamples = chunkAudio.getChannelData(0);
            var windowSize = Math.floor(chunkAudio.sampleRate * RMS_WINDOW_SEC);

            for (var wi = 0; wi < chunkSamples.length - windowSize; wi += windowSize) {
              var sum = 0;
              for (var si = 0; si < windowSize; si++) {
                var sample = chunkSamples[wi + si];
                sum += sample * sample;
              }
              rmsTimeline.push(Math.sqrt(sum / windowSize));
            }
          } catch(chunkErr) {
            // Some chunks may fail at boundaries — fill with silence
            var expectedWindows = Math.floor(CHUNK_DURATION / RMS_WINDOW_SEC);
            for (var fi = 0; fi < expectedWindows; fi++) rmsTimeline.push(0);
          }
          onProgress('decoding', 10 + Math.round((ci / totalChunks) * 80));
        }

        tempCtx.close();

        // Convert RMS timeline to a fake channelData at 10 Hz
        sampleRate = Math.round(1 / RMS_WINDOW_SEC); // 10 Hz
        duration = estDuration;
        channelData = new Float32Array(rmsTimeline);
        _currentAudioBuffer = null; // no full buffer for large files

        console.log('[RecordingAnalyzer] Large file: built RMS timeline (' + rmsTimeline.length + ' windows, ~' + Math.round(estDuration) + 's)');
      } catch(e) {
        console.warn('[RecordingAnalyzer] Chunked decode failed:', e.message);
        throw new Error('Recording too large to process (' + Math.round(fileSize / 1024 / 1024) + 'MB). Try a shorter recording or lower bitrate.');
      }
    } else {
      // Normal file: full decode
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var audioBuffer = await _audioCtx.decodeAudioData(arrayBuffer.slice(0));
      channelData = audioBuffer.getChannelData(0);
      sampleRate = audioBuffer.sampleRate;
      duration = audioBuffer.duration;
      _currentAudioBuffer = audioBuffer;
    }

    // Release the raw ArrayBuffer — we only need channelData now
    arrayBuffer = null;
    onProgress('decoding', 100);

    console.log('[RecordingAnalyzer] Decoded: ' + Math.round(duration) + 's at ' + sampleRate + 'Hz (' + Math.round(channelData.length / 1024 / 1024) + 'M samples)');

    // Stage 2: Segmentation
    onProgress('segmenting', 0);
    var segResult = null;
    if (typeof RehearsalSegmentationEngine !== 'undefined' && RehearsalSegmentationEngine.segmentAudioV2) {
      segResult = RehearsalSegmentationEngine.segmentAudioV2({
        channelData: channelData,
        sampleRate: sampleRate,
        duration: duration
      });
    } else if (typeof RehearsalSegmentationEngine !== 'undefined' && RehearsalSegmentationEngine.segmentAudio) {
      segResult = RehearsalSegmentationEngine.segmentAudio({
        channelData: channelData,
        sampleRate: sampleRate
      });
    }
    onProgress('segmenting', 100);

    // Stage 3: BPM / groove analysis (skip on large files to save memory)
    onProgress('groove', 0);
    var grooveMetrics = null;
    if (!isLargeFile) {
      try {
        if (typeof OfflineAnalyser !== 'undefined') {
          var analyser = new OfflineAnalyser();
          grooveMetrics = await analyser.analyse(
            channelData.buffer.slice(0),
            opts.targetBPM || 120,
            'recording',
            function(pct) { onProgress('groove', Math.round(pct * 100)); }
          );
        }
      } catch(e) {
        console.warn('[RecordingAnalyzer] Groove analysis failed:', e.message);
      }
    } else {
      console.log('[RecordingAnalyzer] Skipping full groove analysis (large file)');
    }
    onProgress('groove', 100);

    // Stage 4: Song matching
    onProgress('matching', 0);
    var events = segResult ? (segResult.events || segResult.segments || []) : [];
    var songCatalog = (typeof allSongs !== 'undefined') ? allSongs : [];
    var segments = events
      .filter(function(e) {
        var t = e.type || e._originalKind || '';
        return t.indexOf('song') !== -1 || t === 'music' || t === 'warmup_jam' || t === 'jam'
          || t === 'section_work' || t === 'strong_moment' || t === 'retry';
      })
      .map(function(e, i) {
        var dur = (e.end_time || e.endSec || 0) - (e.start_time || e.startSec || 0);
        return {
          id: e.id || ('seg_' + i),
          startSec: e.start_time || e.startSec || 0,
          endSec: e.end_time || e.endSec || 0,
          duration: dur,
          type: e.type || e._originalKind || 'unknown',
          songTitle: e.song || _guessSong(e, i, songCatalog),
          confidence: e.confidence || (e.song ? 0.8 : 0.3),
          grooveMetrics: null, // populated per-segment if available
          tags: e.tags || []
        };
      });

    // Label segments without song matches as "Song 1", "Song 2", etc.
    var songNum = 1;
    segments.forEach(function(seg) {
      if (!seg.songTitle && seg.duration >= 60) {
        seg.songTitle = 'Song ' + songNum;
        seg.confidence = 0.1;
        songNum++;
      }
    });

    onProgress('matching', 100);
    _currentSegments = segments;
    _currentSessionId = opts.sessionId || null;

    return {
      segments: segments,
      grooveMetrics: grooveMetrics,
      duration: audioBuffer.duration,
      summary: segResult ? segResult.summary : null,
      songMatches: segments.filter(function(s) { return s.confidence >= 0.5; }).length
    };
  }

  // ── Song Matching Heuristic ─────────────────────────────────────────────────

  function _guessSong(event, index, catalog) {
    // Future: use duration, position in set, BPM matching, etc.
    // For now: if segments have setlist context, match by order
    if (!catalog.length) return null;

    // Try to match from setlist order if available
    var setlistSongs = [];
    try {
      var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
      if (setlists.length) {
        (setlists[0].sets || []).forEach(function(set) {
          (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : (item.title || '');
            if (t) setlistSongs.push(t);
          });
        });
      }
    } catch(e) {}

    if (setlistSongs.length && index < setlistSongs.length) {
      return setlistSongs[index];
    }

    return null;
  }

  // ── UI: Show Segment Review ─────────────────────────────────────────────────

  function showUI(sessionId, segments, duration) {
    _currentSessionId = sessionId;
    _currentSegments = segments || _currentSegments;
    if (!_currentSegments) return;

    var overlay = document.getElementById('raOverlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'raOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';
    // Don't auto-dismiss on backdrop click — user must use Cancel or Generate

    var durLabel = duration ? _formatTime(duration) : '';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card,#1e293b);border:2px solid rgba(99,102,241,0.3);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6)';

    // Notify user the review is ready (toast + audio chime)
    if (typeof showToast === 'function') showToast('Analysis ready \u2014 review segments and generate report', 5000);
    _playNotificationChime();

    // Build smart summary
    var _needsReview = _currentSegments.filter(function(s) { return s.confidence < 0.4; }).length;
    var _confident = _currentSegments.filter(function(s) { return s.confidence >= 0.7; }).length;
    var _summaryParts = [_currentSegments.length + ' segments detected'];
    if (durLabel) _summaryParts[0] += ' \u00B7 ' + durLabel;
    if (_confident > 0) _summaryParts.push(_confident + ' songs matched');
    if (_needsReview > 0) _summaryParts.push(_needsReview + ' need review');

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<div>'
      + '<div style="font-size:1.05em;font-weight:800;color:var(--text,#f1f5f9)">Recording Analysis</div>'
      + '<div style="font-size:0.72em;color:var(--text-dim,#475569)">' + _summaryParts.join(' \u00B7 ') + '</div>'
      + '</div>'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.2em;cursor:pointer">\u2715</button>'
      + '</div>';

    // Segment list
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">';
    _currentSegments.forEach(function(seg, i) {
      var confLabel = seg.confidence >= 0.7 ? '\u2713 confident' : seg.confidence >= 0.4 ? 'check name' : 'needs review';
      var confColor = seg.confidence >= 0.7 ? '#10b981' : seg.confidence >= 0.4 ? '#f59e0b' : '#f87171';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)" data-seg-idx="' + i + '">'
        + '<div style="font-size:0.72em;color:var(--text-dim);min-width:90px;flex-shrink:0">[' + _formatTime(seg.startSec) + ' \u2013 ' + _formatTime(seg.endSec) + ']</div>'
        + '<input type="text" value="' + _escAttr(seg.songTitle || '') + '" onchange="RecordingAnalyzer._updateSegTitle(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 8px;color:var(--text,#f1f5f9);font-size:0.82em;font-family:inherit" placeholder="Song name...">'
        + '<span style="font-size:0.65em;color:' + confColor + ';flex-shrink:0;min-width:50px;text-align:right">' + confLabel + '</span>'
        + '<button onclick="RecordingAnalyzer._removeSegment(' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.78em;flex-shrink:0" title="Remove">\u2715</button>'
        + '</div>';
    });
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:8px;justify-content:flex-end">'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="padding:10px 18px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted,#94a3b8);cursor:pointer;font-size:0.85em;font-weight:600">Cancel</button>'
      + '<button onclick="RecordingAnalyzer.confirmAndGenerate()" style="padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;cursor:pointer;font-size:0.85em;font-weight:700;box-shadow:0 2px 8px rgba(34,197,94,0.2)">Generate Report</button>'
      + '</div>';

    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── UI Helpers ──────────────────────────────────────────────────────────────

  function _updateSegTitle(idx, value) {
    if (_currentSegments && _currentSegments[idx]) {
      _currentSegments[idx].songTitle = value;
      _currentSegments[idx].confidence = value ? 0.9 : 0.1; // user-confirmed = high
    }
  }

  function _removeSegment(idx) {
    if (_currentSegments) {
      _currentSegments.splice(idx, 1);
      showUI(_currentSessionId, _currentSegments);
    }
  }

  // ── Confirm & Generate Report ───────────────────────────────────────────────

  async function confirmAndGenerate() {
    if (!_currentSegments || !_currentSegments.length) {
      if (typeof showToast === 'function') showToast('No segments to analyze');
      return;
    }

    var overlay = document.getElementById('raOverlay');
    var _genMsgs = ['Building your report...', 'Analyzing each song...', 'Generating insights...', 'Almost done...'];
    var _genMsgIdx = 0;
    var _genMsgTimer = null;
    if (overlay) {
      var _genModal = overlay.querySelector('div');
      if (_genModal) {
        _genModal.innerHTML = '<div style="text-align:center;padding:40px">'
          + '<div style="font-size:1.2em;margin-bottom:12px">\uD83D\uDD0D</div>'
          + '<div id="raGenLabel" style="font-size:0.92em;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:8px">Building your report...</div>'
          + '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:12px;max-width:200px;margin-left:auto;margin-right:auto"><div id="raGenBar" style="height:100%;width:10%;background:#22c55e;border-radius:2px;transition:width 0.5s"></div></div>'
          + '</div>';
        _genMsgTimer = setInterval(function() {
          _genMsgIdx = (_genMsgIdx + 1) % _genMsgs.length;
          var lbl = document.getElementById('raGenLabel');
          if (lbl) lbl.textContent = _genMsgs[_genMsgIdx];
          var bar = document.getElementById('raGenBar');
          if (bar) bar.style.width = Math.min(20 + _genMsgIdx * 25, 90) + '%';
        }, 1500);
      }
    }

    try {
      // Build notes text from segments (for the analysis pipeline)
      var notesLines = _currentSegments.map(function(seg) {
        var timeLabel = _formatTime(seg.startSec) + ' - ' + _formatTime(seg.endSec);
        var songLabel = seg.songTitle || 'Unknown';
        var durMin = Math.round(seg.duration / 60);
        return timeLabel + ' ' + songLabel + ' (' + durMin + ' min)';
      });
      var notesText = notesLines.join('\n');

      // If we have a session, update its notes and re-run analysis
      if (_currentSessionId && typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.run) {
        // Save segment notes to session
        if (typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
          await firebaseDB.ref(bandPath('rehearsal_sessions/' + _currentSessionId + '/notes')).set(notesText);
          await firebaseDB.ref(bandPath('rehearsal_sessions/' + _currentSessionId + '/audio_segments')).set(_currentSegments);
        }

        var result = await RehearsalAnalysis.run(_currentSessionId, {
          audioBuffer: _currentAudioBuffer,
          force: true
        });

        if (_genMsgTimer) clearInterval(_genMsgTimer);

        // Count issues for result message
        var _issueCount = 0;
        if (result && result.analysis && result.analysis.insights) {
          _issueCount = (result.analysis.insights.issues || []).length;
        }
        var _resultMsg = 'Report ready';
        if (_issueCount > 0) _resultMsg += ' \u2014 ' + _issueCount + ' song' + (_issueCount > 1 ? 's' : '') + ' need attention';

        if (typeof showToast === 'function') showToast(_resultMsg, 3000);
        if (overlay) overlay.remove();

        // Close the loop: refresh Home data so hero/practice/status update
        _refreshHomeAfterAnalysis();

        // Show the report
        if (typeof _rhShowSessionReport === 'function') {
          _rhShowSessionReport(_currentSessionId);
        }

        return result;
      }

      if (_genMsgTimer) clearInterval(_genMsgTimer);
      if (overlay) overlay.remove();
      if (typeof showToast === 'function') showToast('Analysis complete \u2014 ' + _currentSegments.length + ' segments');

    } catch(e) {
      if (_genMsgTimer) clearInterval(_genMsgTimer);
      console.error('[RecordingAnalyzer] Generate failed:', e);
      if (overlay) overlay.remove();
      if (typeof showToast === 'function') showToast('Analysis failed: ' + e.message);
    }
  }

  // ── Launch from Rehearsal Page ───────────────────────────────────────────────

  /**
   * Show file picker and run full analysis.
   * @param {string} sessionId - Firebase session ID to attach results to
   */
  function launchForSession(sessionId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async function() {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];

      // Show progress overlay
      var overlay = document.createElement('div');
      overlay.id = 'raOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px';
      var progress = document.createElement('div');
      progress.style.cssText = 'background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px 40px;text-align:center;min-width:300px';
      progress.innerHTML = '<div style="font-size:1.2em;margin-bottom:12px">\uD83C\uDFA7</div>'
        + '<div style="font-size:0.92em;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:8px">Analyzing your rehearsal...</div>'
        + '<div id="raProgressLabel" style="font-size:0.78em;color:var(--text-dim,#475569)">Decoding audio...</div>'
        + '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:12px"><div id="raProgressBar" style="height:100%;width:0%;background:#667eea;border-radius:2px;transition:width 0.3s"></div></div>';
      overlay.appendChild(progress);
      document.body.appendChild(overlay);

      var stageMessages = {
        decoding:   ['Decoding audio...', 'Reading your recording...', 'Loading audio data...'],
        segmenting: ['Finding your songs...', 'Detecting transitions...', 'Splitting segments...'],
        groove:     ['Measuring tempo stability...', 'Checking groove...', 'Analyzing rhythm...'],
        matching:   ['Matching songs to your catalog...', 'Identifying songs...', 'Building your rehearsal report...']
      };
      var stageWeights = { decoding: 0.2, segmenting: 0.4, groove: 0.3, matching: 0.1 };
      var stageOffsets = { decoding: 0, segmenting: 0.2, groove: 0.6, matching: 0.9 };
      var _msgIdx = {};

      try {
        var result = await analyze(file, {
          sessionId: sessionId,
          targetBPM: 120,
          onProgress: function(stage, pct) {
            var label = document.getElementById('raProgressLabel');
            var bar = document.getElementById('raProgressBar');
            if (label) {
              var msgs = stageMessages[stage] || [stage];
              if (!_msgIdx[stage]) _msgIdx[stage] = 0;
              // Rotate messages every 30% progress within stage
              var idx = Math.min(Math.floor(pct / 35), msgs.length - 1);
              label.textContent = msgs[idx];
            }
            var totalPct = Math.round(((stageOffsets[stage] || 0) + (stageWeights[stage] || 0.25) * (pct / 100)) * 100);
            if (bar) bar.style.width = Math.min(totalPct, 100) + '%';
          }
        });

        if (result.segments && result.segments.length > 0) {
          // Show segment review UI
          showUI(sessionId, result.segments, result.duration);
        } else {
          // No segments detected — show completion with manual option
          if (overlay) {
            progress.innerHTML = '<div style="font-size:1.2em;margin-bottom:12px">\u2705</div>'
              + '<div style="font-size:0.92em;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:8px">Analysis complete</div>'
              + '<div style="font-size:0.78em;color:var(--text-dim,#475569);margin-bottom:16px">No clear song segments detected. This can happen with long jam sessions or continuous recordings.</div>'
              + '<div style="display:flex;gap:8px;justify-content:center">'
              + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted);cursor:pointer;font-size:0.82em">Close</button>'
              + '<button onclick="document.getElementById(\'raOverlay\').remove();if(typeof _rhRecreateFromRecording===\'function\')_rhRecreateFromRecording()" style="padding:8px 16px;border-radius:8px;border:none;background:rgba(99,102,241,0.15);color:#818cf8;cursor:pointer;font-size:0.82em;font-weight:600">Add Notes Manually</button>'
              + '</div>';
          }
          if (typeof showToast === 'function') showToast('Analysis complete \u2014 add notes manually for a detailed report', 5000);
        }

      } catch(e) {
        console.error('[RecordingAnalyzer] Analysis failed:', e);
        if (overlay) overlay.remove();
        if (typeof showToast === 'function') showToast('Analysis failed: ' + e.message, 5000);
      }
    };
    input.click();
  }

  // ── Close the Loop: Refresh Home after analysis ─────────────────────────────

  function _refreshHomeAfterAnalysis() {
    try {
      // Invalidate focus cache so Home hero recalculates
      if (typeof GLStore !== 'undefined' && GLStore.invalidateFocusCache) {
        GLStore.invalidateFocusCache();
      }
      // Refresh Home dashboard if it's the current page
      if (typeof GLStore !== 'undefined' && GLStore.getActivePage && GLStore.getActivePage() === 'home') {
        if (typeof refreshHomeDashboard === 'function') refreshHomeDashboard();
      }
      // Refresh rehearsal page (re-render session list with updated analysis)
      if (typeof renderRehearsalPage === 'function') {
        setTimeout(function() { renderRehearsalPage(); }, 500);
      }
    } catch(e) {
      console.warn('[RecordingAnalyzer] Home refresh failed:', e.message);
    }
  }

  // ── Audio notification chime (Web Audio API, no file needed) ─────────────────

  function _playNotificationChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  function _formatTime(sec) {
    if (!sec && sec !== 0) return '0:00';
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _escAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    analyze: analyze,
    showUI: showUI,
    confirmAndGenerate: confirmAndGenerate,
    launchForSession: launchForSession,
    _updateSegTitle: _updateSegTitle,
    _removeSegment: _removeSegment
  };

})();
