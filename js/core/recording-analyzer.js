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
  var _currentAudioUrl = null; // blob URL for playback
  var _currentAudioEl = null;  // shared <audio> element
  var _recordingContext = null; // { type: 'rehearsal'|'gig'|'practice', referenceSongs: [], referenceId: '' }
  var _planVsActual = null;    // { planned, detected, played, repeated, missing, unplanned }

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
      // Large file: decode in chunks to avoid OOM.
      // decodeAudioData on the full 337MB MP3 crashes Chrome (2GB+ PCM expansion).
      // Instead: decode small slices, extract RMS energy per chunk, release each chunk.
      console.log('[RecordingAnalyzer] Large file — chunked decode with RMS extraction');
      try {
        var CHUNK_DURATION = 30; // seconds per chunk
        var tempCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Probe first 2MB to estimate bitrate and duration
        var probeSize = Math.min(arrayBuffer.byteLength, 2 * 1024 * 1024);
        var probeBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0, probeSize));
        var bitrate = (probeSize * 8) / probeBuffer.duration;
        duration = (arrayBuffer.byteLength * 8) / bitrate;
        onProgress('decoding', 10);

        // Build RMS energy timeline from chunks (100ms windows)
        var RMS_WINDOW_SEC = 0.1;
        var rmsTimeline = [];
        var chunkBytes = Math.ceil(bitrate * CHUNK_DURATION / 8);
        var totalChunks = Math.ceil(arrayBuffer.byteLength / chunkBytes);

        for (var ci = 0; ci < totalChunks; ci++) {
          var start = ci * chunkBytes;
          var end = Math.min(start + chunkBytes + 4096, arrayBuffer.byteLength);
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
            // Chunk at MP3 frame boundary — fill with silence
            var expectedWindows = Math.floor(CHUNK_DURATION / RMS_WINDOW_SEC);
            for (var fi = 0; fi < expectedWindows; fi++) rmsTimeline.push(0);
          }
          onProgress('decoding', 10 + Math.round((ci / totalChunks) * 80));
        }

        tempCtx.close();
        sampleRate = Math.round(1 / RMS_WINDOW_SEC); // 10 Hz
        channelData = new Float32Array(rmsTimeline);
        _currentAudioBuffer = null;
        console.log('[RecordingAnalyzer] Large file: built RMS timeline (' + rmsTimeline.length + ' windows, ~' + Math.round(duration) + 's)');
      } catch(e) {
        console.error('[RecordingAnalyzer] Chunked decode failed:', e);
        throw new Error('Recording too large (' + Math.round(fileSize / 1024 / 1024) + 'MB). Try "Recreate from Recording" with manual notes instead.');
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
    if (isLargeFile) {
      // Large file: use simple RMS-based segmentation on the energy timeline
      segResult = _segmentFromRMS(channelData, duration);
    } else if (typeof RehearsalSegmentationEngine !== 'undefined' && RehearsalSegmentationEngine.segmentAudioV2) {
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

    // Label segments without song matches
    var songNum = 1;
    segments.forEach(function(seg) {
      if (!seg.songTitle && seg.duration >= 60) {
        seg.songTitle = 'Song ' + songNum;
        seg.confidence = 0.1;
        songNum++;
      }
      // Default segment type
      if (!seg.segType) seg.segType = 'song';
    });

    // Flag segments not in plan
    if (_recordingContext && _recordingContext.referenceSongs && _recordingContext.referenceSongs.length) {
      var _planSet = {};
      _recordingContext.referenceSongs.forEach(function(s) { _planSet[s.toLowerCase()] = true; });
      segments.forEach(function(seg) {
        if (seg.songTitle && !_planSet[seg.songTitle.toLowerCase()]) {
          seg.unplanned = true;
        }
      });
    }

    // Build plan vs actual comparison
    _buildPlanVsActual(segments);

    onProgress('matching', 100);
    _currentSegments = segments;
    _currentSessionId = opts.sessionId || null;

    return {
      segments: segments,
      grooveMetrics: grooveMetrics,
      duration: duration,
      summary: segResult ? segResult.summary : null,
      songMatches: segments.filter(function(s) { return s.confidence >= 0.5; }).length,
      planVsActual: _planVsActual,
      recordingType: _recordingContext ? _recordingContext.type : null
    };
  }

  // ── Song Matching Heuristic ─────────────────────────────────────────────────

  function _guessSong(event, index, catalog) {
    // Priority 1: Use context-specific reference songs
    if (_recordingContext && _recordingContext.referenceSongs && _recordingContext.referenceSongs.length) {
      var refSongs = _recordingContext.referenceSongs;

      // Practice mode: all segments are the same song
      if (_recordingContext.type === 'practice' && refSongs[0]) {
        return refSongs[0];
      }

      // Rehearsal/gig: match by segment order within reference
      if (index < refSongs.length) {
        return refSongs[index];
      }

      // Beyond reference list — mark as unplanned
      return null;
    }

    // Fallback: try setlist order
    var setlistSongs = _getSetlistSongs();
    if (setlistSongs.length && index < setlistSongs.length) {
      return setlistSongs[index];
    }

    return null;
  }

  // ── Plan vs Actual Comparison ───────────────────────────────────────────────

  function _buildPlanVsActual(segments) {
    if (!_recordingContext || !_recordingContext.referenceSongs || !_recordingContext.referenceSongs.length) {
      _planVsActual = null;
      return;
    }

    var planned = _recordingContext.referenceSongs.slice();
    var detected = {};
    var songSegments = segments.filter(function(s) { return !s.segType || s.segType === 'song' || s.segType === 'restart'; });
    songSegments.forEach(function(s) {
      if (s.songTitle) {
        detected[s.songTitle] = (detected[s.songTitle] || 0) + 1;
      }
    });

    var played = [];      // songs in plan that were detected
    var repeated = [];    // songs with >1 attempt
    var missing = [];     // songs in plan but NOT detected
    var unplanned = [];   // songs detected but NOT in plan

    var plannedSet = {};
    planned.forEach(function(s) { plannedSet[s] = true; });

    planned.forEach(function(s) {
      if (detected[s]) {
        played.push(s);
        if (detected[s] > 1) repeated.push({ title: s, attempts: detected[s] });
      } else {
        missing.push(s);
      }
    });

    Object.keys(detected).forEach(function(s) {
      if (!plannedSet[s]) {
        unplanned.push(s);
      }
    });

    _planVsActual = {
      planned: planned,
      detected: Object.keys(detected),
      played: played,
      repeated: repeated,
      missing: missing,
      unplanned: unplanned
    };

    console.log('[RecordingAnalyzer] Plan vs Actual: ' + played.length + ' played, ' + missing.length + ' missing, ' + unplanned.length + ' unplanned, ' + repeated.length + ' repeated');
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

    var durLabel = duration ? _formatTime(duration) : '';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card,#1e293b);border:2px solid rgba(99,102,241,0.3);border-radius:16px;padding:20px;max-width:700px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.6)';

    if (typeof showToast === 'function') showToast('Analysis ready \u2014 review and generate report', 5000);
    _playNotificationChime();

    // Auto-label duplicate songs as "Song (Attempt N)"
    var _songCounts = {};
    _currentSegments.forEach(function(seg) {
      if (seg.songTitle && seg.segType !== 'talking' && seg.segType !== 'ignore') {
        _songCounts[seg.songTitle] = (_songCounts[seg.songTitle] || 0) + 1;
      }
    });
    var _songSeen = {};
    _currentSegments.forEach(function(seg) {
      if (seg.songTitle && _songCounts[seg.songTitle] > 1 && seg.segType !== 'talking' && seg.segType !== 'ignore') {
        _songSeen[seg.songTitle] = (_songSeen[seg.songTitle] || 0) + 1;
        seg.displayTitle = seg.songTitle + ' (Attempt ' + _songSeen[seg.songTitle] + ')';
      } else {
        seg.displayTitle = seg.songTitle || '';
      }
    });

    // Summary
    var _needsReview = _currentSegments.filter(function(s) { return s.confidence < 0.4; }).length;
    var _songs = _currentSegments.filter(function(s) { return !s.segType || s.segType === 'song'; }).length;
    var _summaryParts = [_currentSegments.length + ' segments'];
    if (durLabel) _summaryParts[0] += ' \u00B7 ' + durLabel;
    _summaryParts.push(_songs + ' songs');
    if (_needsReview > 0) _summaryParts.push(_needsReview + ' need review');
    if (_planVsActual && _planVsActual.missing.length > 0) _summaryParts.push(_planVsActual.missing.length + ' missing from plan');

    var _segTypes = [['song','Song'],['restart','Restart'],['talking','Talking'],['jam','Jam / Improv'],['ignore','Ignore']];

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<div>'
      + '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9)">Recording Analysis</div>'
      + '<div style="font-size:0.7em;color:var(--text-dim,#475569)">' + _summaryParts.join(' \u00B7 ') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + (_needsReview > 0 ? '<button onclick="RecordingAnalyzer._jumpToNextReview()" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);color:#f87171;cursor:pointer;font-weight:600">Next to review \u25BC</button>' : '')
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1em;cursor:pointer">\u2715</button>'
      + '</div></div>';

    // Plan vs Actual banner (if data exists)
    if (_planVsActual) {
      var pva = _planVsActual;
      var pvaHtml = '<div style="padding:8px 10px;border-radius:8px;margin-bottom:10px;font-size:0.72em;'
        + (pva.missing.length > 0 ? 'border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04)' : 'border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.04)')
        + '">';
      pvaHtml += '<div style="font-weight:700;color:var(--text-muted);margin-bottom:4px">Plan vs Actual</div>';
      pvaHtml += '<div style="color:var(--text-dim);line-height:1.5">';
      pvaHtml += '<span style="color:#10b981">' + pva.played.length + '/' + pva.planned.length + ' played</span>';
      if (pva.repeated.length) pvaHtml += ' \u00B7 ' + pva.repeated.map(function(r) { return r.title + ' \u00D7' + r.attempts; }).join(', ');
      if (pva.missing.length) pvaHtml += '<br><span style="color:#fbbf24">Missing: ' + pva.missing.join(', ') + '</span>';
      if (pva.unplanned.length) pvaHtml += '<br><span style="color:#818cf8">Unplanned: ' + pva.unplanned.join(', ') + '</span>';
      pvaHtml += '</div></div>';
      html += pvaHtml;
    }

    // Hidden audio element for playback
    html += '<audio id="raPlaybackAudio" src="' + _escAttr(_currentAudioUrl || '') + '" preload="metadata" style="display:none"></audio>';

    // Segment list
    html += '<div id="raSegList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';
    _currentSegments.forEach(function(seg, i) {
      var needsReview = seg.confidence < 0.4;
      var isUnplanned = seg.unplanned;
      var borderColor = needsReview ? 'rgba(248,113,113,0.2)' : (isUnplanned ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.06)');
      var bgColor = needsReview ? 'rgba(248,113,113,0.03)' : (isUnplanned ? 'rgba(129,140,248,0.03)' : 'rgba(255,255,255,0.02)');
      var durMin = Math.round(seg.duration / 60);
      var durLabel2 = seg.duration >= 60 ? durMin + 'm' : Math.round(seg.duration) + 's';
      var segTypeVal = seg.segType || 'song';

      html += '<div id="raSeg' + i + '" style="padding:8px 10px;border-radius:8px;border:1px solid ' + borderColor + ';background:' + bgColor + '">'
        // Row 1: play + time + name input + type dropdown
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<button onclick="RecordingAnalyzer._playSeg(' + i + ')" style="background:none;border:none;color:#818cf8;cursor:pointer;font-size:0.9em;flex-shrink:0;padding:2px" title="Play this segment" id="raPlayBtn' + i + '">\u25B6</button>'
        + '<div style="font-size:0.65em;color:var(--text-dim);min-width:80px;flex-shrink:0">' + _formatTime(seg.startSec) + '\u2013' + _formatTime(seg.endSec) + '<br>' + durLabel2 + '</div>'
        + '<input type="text" value="' + _escAttr(seg.displayTitle || '') + '" onchange="RecordingAnalyzer._updateSegTitle(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 6px;color:var(--text,#f1f5f9);font-size:0.78em;font-family:inherit;min-width:0" placeholder="Song name...">'
        + '<select onchange="RecordingAnalyzer._updateSegType(' + i + ',this.value)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:3px 4px;color:var(--text-dim);font-size:0.65em;flex-shrink:0;font-family:inherit">'
        + _segTypes.map(function(t) { return '<option value="' + t[0] + '"' + (t[0] === segTypeVal ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('')
        + '</select>'
        // Row 1 actions: merge + remove
        + '<button onclick="RecordingAnalyzer._mergeWithPrev(' + i + ')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.6em;flex-shrink:0;padding:2px" title="Merge with previous"' + (i === 0 ? ' disabled style="opacity:0.3"' : '') + '>\u2B06\uFE0F</button>'
        + '<button onclick="RecordingAnalyzer._removeSegment(' + i + ')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.72em;flex-shrink:0;padding:2px" title="Remove">\u2715</button>'
        + '</div>';

      // Row 2: notes field for talking segments
      if (segTypeVal === 'talking') {
        html += '<div style="margin-top:4px"><input type="text" value="' + _escAttr(seg.notes || '') + '" onchange="RecordingAnalyzer._updateSegNotes(' + i + ',this.value)" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:3px 6px;color:var(--text-dim);font-size:0.72em;font-family:inherit" placeholder="What was discussed..."></div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:var(--bg-card,#1e293b);padding:8px 0 0">'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted,#94a3b8);cursor:pointer;font-size:0.82em;font-weight:600">Cancel</button>'
      + '<button onclick="RecordingAnalyzer.confirmAndGenerate()" style="padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;cursor:pointer;font-size:0.82em;font-weight:700;box-shadow:0 2px 8px rgba(34,197,94,0.2)">Generate Report</button>'
      + '</div>';

    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── UI Helpers ──────────────────────────────────────────────────────────────

  function _updateSegTitle(idx, value) {
    if (_currentSegments && _currentSegments[idx]) {
      _currentSegments[idx].songTitle = value;
      _currentSegments[idx].displayTitle = value;
      _currentSegments[idx].confidence = value ? 0.9 : 0.1;
    }
  }

  function _updateSegType(idx, type) {
    if (_currentSegments && _currentSegments[idx]) {
      _currentSegments[idx].segType = type;
      // Re-render to show/hide notes field for talking
      showUI(_currentSessionId, _currentSegments);
    }
  }

  function _updateSegNotes(idx, notes) {
    if (_currentSegments && _currentSegments[idx]) {
      _currentSegments[idx].notes = notes;
    }
  }

  function _removeSegment(idx) {
    if (_currentSegments) {
      _currentSegments.splice(idx, 1);
      showUI(_currentSessionId, _currentSegments);
    }
  }

  function _mergeWithPrev(idx) {
    if (!_currentSegments || idx <= 0) return;
    var prev = _currentSegments[idx - 1];
    var curr = _currentSegments[idx];
    prev.endSec = curr.endSec;
    prev.duration = prev.endSec - prev.startSec;
    if (!prev.songTitle && curr.songTitle) prev.songTitle = curr.songTitle;
    _currentSegments.splice(idx, 1);
    showUI(_currentSessionId, _currentSegments);
  }

  function _playSeg(idx) {
    if (!_currentAudioUrl || !_currentSegments || !_currentSegments[idx]) return;
    var seg = _currentSegments[idx];
    var audio = document.getElementById('raPlaybackAudio');
    if (!audio) return;

    // Stop if already playing this segment
    if (_currentPlayingIdx === idx && !audio.paused) {
      audio.pause();
      var btn = document.getElementById('raPlayBtn' + idx);
      if (btn) btn.textContent = '\u25B6';
      _currentPlayingIdx = -1;
      return;
    }

    // Reset previous playing button
    if (_currentPlayingIdx >= 0) {
      var prevBtn = document.getElementById('raPlayBtn' + _currentPlayingIdx);
      if (prevBtn) prevBtn.textContent = '\u25B6';
    }

    audio.currentTime = seg.startSec;
    audio.play();
    _currentPlayingIdx = idx;
    var btn = document.getElementById('raPlayBtn' + idx);
    if (btn) btn.textContent = '\u23F8';

    // Stop at segment end
    var _stopCheck = function() {
      if (audio.currentTime >= seg.endSec || audio.paused) {
        audio.pause();
        if (btn) btn.textContent = '\u25B6';
        _currentPlayingIdx = -1;
        audio.removeEventListener('timeupdate', _stopCheck);
      }
    };
    audio.addEventListener('timeupdate', _stopCheck);
  }
  var _currentPlayingIdx = -1;

  function _jumpToNextReview() {
    if (!_currentSegments) return;
    for (var i = 0; i < _currentSegments.length; i++) {
      if (_currentSegments[i].confidence < 0.4) {
        var el = document.getElementById('raSeg' + i);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'box-shadow 0.3s';
          el.style.boxShadow = '0 0 12px rgba(248,113,113,0.3)';
          setTimeout(function() { el.style.boxShadow = ''; }, 2000);
        }
        return;
      }
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
      // Filter out ignored segments; build notes from the rest
      var activeSegs = _currentSegments.filter(function(s) { return s.segType !== 'ignore'; });
      var notesLines = activeSegs.map(function(seg) {
        var timeLabel = _formatTime(seg.startSec) + ' - ' + _formatTime(seg.endSec);
        var type = seg.segType || 'song';
        if (type === 'talking') {
          return timeLabel + ' [Discussion]' + (seg.notes ? ' ' + seg.notes : '');
        }
        if (type === 'restart') {
          return timeLabel + ' [Restart] ' + (seg.songTitle || '');
        }
        if (type === 'jam') {
          return timeLabel + ' [Jam] ' + (seg.songTitle || 'Improv');
        }
        var songLabel = seg.songTitle || 'Unknown';
        var durMin = Math.round(seg.duration / 60);
        return timeLabel + ' ' + songLabel + ' (' + durMin + ' min)';
      });
      var notesText = notesLines.join('\n');

      // If we have a session, update its notes and re-run analysis
      if (_currentSessionId && typeof RehearsalAnalysis !== 'undefined' && RehearsalAnalysis.run) {
        // Rebuild plan vs actual from current (possibly edited) segments
        _buildPlanVsActual(_currentSegments);

        // Save to Firebase
        if (typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
          var sessPath = bandPath('rehearsal_sessions/' + _currentSessionId);
          await firebaseDB.ref(sessPath + '/notes').set(notesText);
          await firebaseDB.ref(sessPath + '/audio_segments').set(activeSegs);
          if (_recordingContext) await firebaseDB.ref(sessPath + '/recording_context').set(_recordingContext);
          if (_planVsActual) await firebaseDB.ref(sessPath + '/plan_vs_actual').set(_planVsActual);
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
   * Show context picker, then file picker, then run analysis.
   * @param {string} sessionId - Firebase session ID to attach results to
   */
  function launchForSession(sessionId) {
    // Step 1: Show context picker
    _showContextPicker(sessionId);
  }

  function _showContextPicker(sessionId) {
    var existing = document.getElementById('raOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'raOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';

    // Build setlist options for gig picker
    var setlistOpts = '';
    try {
      var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
      setlists.forEach(function(sl) { setlistOpts += '<option value="' + _escAttr(sl.name || sl.setlistId || '') + '">' + _escAttr(sl.name || 'Setlist') + '</option>'; });
    } catch(e) {}

    // Build song options for practice picker
    var songOpts = '';
    try {
      var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
      songs.slice(0, 100).forEach(function(s) { songOpts += '<option value="' + _escAttr(s.title) + '">' + _escAttr(s.title) + '</option>'; });
    } catch(e) {}

    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6)';
    modal.innerHTML = '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:4px">What is this recording?</div>'
      + '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-bottom:16px">This helps match songs accurately</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px">'
      + '<button onclick="RecordingAnalyzer._selectContext(\'rehearsal\',\'' + _escAttr(sessionId) + '\')" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:var(--text,#f1f5f9);cursor:pointer;text-align:left;font-family:inherit"><div style="font-weight:700;font-size:0.88em">\uD83E\uDD41 Band Rehearsal</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Match against rehearsal plan</div></button>'
      + '<button onclick="RecordingAnalyzer._selectContext(\'gig\',\'' + _escAttr(sessionId) + '\')" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.04);color:var(--text,#f1f5f9);cursor:pointer;text-align:left;font-family:inherit"><div style="font-weight:700;font-size:0.88em">\uD83C\uDFA4 Live Gig</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Match against setlist</div></button>'
      + '<button onclick="RecordingAnalyzer._selectContext(\'practice\',\'' + _escAttr(sessionId) + '\')" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text,#f1f5f9);cursor:pointer;text-align:left;font-family:inherit"><div style="font-weight:700;font-size:0.88em">\uD83C\uDFB8 Individual Practice</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Single song focus</div></button>'
      + '</div>'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="margin-top:12px;width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em">Cancel</button>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function _selectContext(type, sessionId) {
    // Build reference song list based on context
    var referenceSongs = [];

    if (type === 'rehearsal') {
      // Get songs from rehearsal plan (saved planner queue)
      try {
        var plan = (typeof window.glPlannerQueue !== 'undefined') ? window.glPlannerQueue : [];
        referenceSongs = plan.map(function(item) { return typeof item === 'string' ? item : (item.title || ''); }).filter(Boolean);
      } catch(e) {}
      // Fallback to setlist if no plan
      if (!referenceSongs.length) referenceSongs = _getSetlistSongs();
    } else if (type === 'gig') {
      referenceSongs = _getSetlistSongs();
    } else if (type === 'practice') {
      // Use currently selected song or focus song
      try {
        if (typeof GLStore !== 'undefined' && GLStore.getActiveSong && GLStore.getActiveSong()) {
          referenceSongs = [GLStore.getActiveSong()];
        } else if (typeof selectedSong !== 'undefined' && selectedSong && selectedSong.title) {
          referenceSongs = [selectedSong.title];
        }
      } catch(e) {}
    }

    _recordingContext = { type: type, referenceSongs: referenceSongs, referenceId: sessionId };
    console.log('[RecordingAnalyzer] Context: ' + type + ', reference songs: ' + referenceSongs.length);

    // Remove context picker and proceed to file selection
    var overlay = document.getElementById('raOverlay');
    if (overlay) overlay.remove();
    _launchFilePicker(sessionId);
  }

  function _getSetlistSongs() {
    var songs = [];
    try {
      var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
      if (setlists.length) {
        (setlists[0].sets || []).forEach(function(set) {
          (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : (item.title || '');
            if (t) songs.push(t);
          });
        });
      }
    } catch(e) {}
    return songs;
  }

  function _launchFilePicker(sessionId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async function() {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];

      // Create blob URL for segment playback
      if (_currentAudioUrl) try { URL.revokeObjectURL(_currentAudioUrl); } catch(e) {}
      _currentAudioUrl = URL.createObjectURL(file);

      // Show progress overlay
      var overlay = document.createElement('div');
      overlay.id = 'raOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px';
      var progress = document.createElement('div');
      progress.style.cssText = 'background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px 40px;text-align:center;min-width:300px';
      var typeLabel = _recordingContext ? { rehearsal: 'rehearsal', gig: 'gig recording', practice: 'practice session' }[_recordingContext.type] || 'recording' : 'recording';
      progress.innerHTML = '<div style="font-size:1.2em;margin-bottom:12px">\uD83C\uDFA7</div>'
        + '<div style="font-size:0.92em;font-weight:700;color:var(--text,#f1f5f9);margin-bottom:8px">Analyzing your ' + typeLabel + '...</div>'
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

  // ── Simple RMS-based segmenter for large files ───────────────────────────────
  // Works on the 10Hz energy timeline (one RMS value per 100ms window).
  // Detects music vs silence by comparing energy to a rolling baseline.

  function _segmentFromRMS(rmsData, totalDuration) {
    var RMS_WINDOW_SEC = 0.1; // each sample = 100ms
    var SILENCE_THRESHOLD = 0.3; // fraction of median energy below which = silence
    var MIN_SILENCE_WINDOWS = 30; // 3 seconds minimum silence gap
    var MIN_MUSIC_WINDOWS = 300; // 30 seconds minimum for a "song" segment

    // Compute median energy (ignoring zeros)
    var nonZero = [];
    for (var i = 0; i < rmsData.length; i++) {
      if (rmsData[i] > 0.0001) nonZero.push(rmsData[i]);
    }
    nonZero.sort(function(a, b) { return a - b; });
    var median = nonZero.length > 0 ? nonZero[Math.floor(nonZero.length / 2)] : 0.01;
    var threshold = median * SILENCE_THRESHOLD;

    // Walk through timeline, classify each window
    var segments = [];
    var inMusic = false;
    var segStart = 0;
    var silenceCount = 0;

    for (var wi = 0; wi < rmsData.length; wi++) {
      var isSilent = rmsData[wi] < threshold;

      if (inMusic) {
        if (isSilent) {
          silenceCount++;
          if (silenceCount >= MIN_SILENCE_WINDOWS) {
            // End of music segment
            var endWindow = wi - silenceCount;
            var segDuration = endWindow - segStart;
            if (segDuration >= MIN_MUSIC_WINDOWS) {
              segments.push({
                start_time: segStart * RMS_WINDOW_SEC,
                end_time: endWindow * RMS_WINDOW_SEC,
                type: segDuration >= 1200 ? 'song_full' : (segDuration >= 300 ? 'song_partial' : 'section_work'),
                _originalKind: 'music'
              });
            }
            inMusic = false;
            silenceCount = 0;
          }
        } else {
          silenceCount = 0;
        }
      } else {
        if (!isSilent) {
          inMusic = true;
          segStart = wi;
          silenceCount = 0;
        }
      }
    }

    // Close final segment
    if (inMusic) {
      var finalDuration = rmsData.length - segStart;
      if (finalDuration >= MIN_MUSIC_WINDOWS) {
        segments.push({
          start_time: segStart * RMS_WINDOW_SEC,
          end_time: rmsData.length * RMS_WINDOW_SEC,
          type: finalDuration >= 1200 ? 'song_full' : 'song_partial',
          _originalKind: 'music'
        });
      }
    }

    console.log('[RecordingAnalyzer] RMS segmentation: ' + segments.length + ' segments from ' + rmsData.length + ' windows (median energy: ' + median.toFixed(4) + ', threshold: ' + threshold.toFixed(4) + ')');

    return {
      events: segments,
      summary: {
        totalEvents: segments.length,
        songFull: segments.filter(function(s) { return s.type === 'song_full'; }).length,
        songPartial: segments.filter(function(s) { return s.type === 'song_partial'; }).length
      }
    };
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
    _updateSegType: _updateSegType,
    _updateSegNotes: _updateSegNotes,
    _removeSegment: _removeSegment,
    _mergeWithPrev: _mergeWithPrev,
    _playSeg: _playSeg,
    _jumpToNextReview: _jumpToNextReview,
    _selectContext: _selectContext
  };

})();
