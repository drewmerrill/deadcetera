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

    // Allow callers to set recording context via opts (bypasses UI picker)
    if (opts.referenceSongs || opts.contextType) {
      _recordingContext = {
        type: opts.contextType || 'rehearsal',
        referenceSongs: opts.referenceSongs || [],
        referenceId: opts.sessionId || ''
      };
    }

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

    // For large files: keep arrayBuffer + bitrate for on-demand segment decode.
    // For normal files: release — we have the full channelData already.
    var _rawBytes = isLargeFile ? arrayBuffer : null;
    var _rawBitrate = isLargeFile ? bitrate : 0;
    arrayBuffer = null; // release the local ref (large file data lives in _rawBytes)
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

    // Stage 3: Build segment list (song + talking) for feature extraction
    onProgress('groove', 0);
    var events = segResult ? (segResult.events || segResult.segments || []) : [];
    var songCatalog = (typeof allSongs !== 'undefined') ? allSongs : [];

    // Keep both music segments (for matching) and speech segments (for transcription)
    var _allEvents = events.map(function(e, i) {
      var dur = (e.end_time || e.endSec || 0) - (e.start_time || e.startSec || 0);
      return {
        id: e.id || ('seg_' + i),
        startSec: e.start_time || e.startSec || 0,
        endSec: e.end_time || e.endSec || 0,
        duration: dur,
        type: e.type || e._originalKind || '',
        kind: e.kind || e.type || '',
        intent: e.intent || '',
        songTitle: e.song || null,
        confidence: e.confidence || 0.3,
        grooveMetrics: null,
        tags: e.tags || []
      };
    });

    // Separate speech segments for transcription
    var _talkSegments = _allEvents.filter(function(e) {
      return e.kind === 'speech' || e.intent === 'discussion';
    });

    // Music segments for matching (existing filter)
    var segments = _allEvents.filter(function(e) {
      var t = e.type || '';
      return t.indexOf('song') !== -1 || t === 'music' || t === 'warmup_jam' || t === 'jam'
        || t === 'section_work' || t === 'strong_moment' || t === 'retry';
    });

    // ── Stage 3: Per-segment feature extraction (BPM + groove + embeddings) ────
    // Unified loop: for each segment, decode a short audio slice and run all
    // available extractors. Works on both normal files (PCM in memory) and
    // large files (on-demand decode from raw MP3 bytes).
    var _bpmExtracted = 0;
    var _grooveExtracted = 0;
    var _embedsExtracted = 0;
    var _chordsExtracted = 0;
    var _MIN_FEAT_DURATION = 20; // seconds — minimum for BPM/groove
    var _MIN_EMBED_DURATION = 30; // seconds — minimum for CLAP embedding
    var _SLICE_SEC = 30;          // analyze up to 30s from each segment

    // Check external service availability (shared across all segments)
    var _embedServiceUrl = window._glEmbedServiceUrl || 'http://localhost:8200';
    var _embedServiceAvailable = false;
    var _chordServiceUrl = window._glChordServiceUrl || 'http://localhost:8100';
    var _chordServiceAvailable = false;

    // Probe both services in parallel (1.5s timeout each)
    var _probes = [];
    _probes.push(fetch(_embedServiceUrl + '/health', { signal: AbortSignal.timeout(1500) })
      .then(function(r) { return r.json(); })
      .then(function(d) { _embedServiceAvailable = d.status === 'ok' || d.status === 'ready'; })
      .catch(function() {}));
    _probes.push(fetch(_chordServiceUrl + '/health', { signal: AbortSignal.timeout(1500) })
      .then(function(r) { return r.json(); })
      .then(function(d) { _chordServiceAvailable = d.status === 'ok'; })
      .catch(function() {}));
    await Promise.all(_probes);

    console.log('[RecordingAnalyzer] Feature extraction: ' + segments.length + ' segments' +
      (isLargeFile ? ' (large file — on-demand decode)' : ' (full PCM)') +
      ', embed: ' + (_embedServiceAvailable ? 'YES' : 'no') +
      ', chords: ' + (_chordServiceAvailable ? 'YES' : 'no'));

    for (var _fi = 0; _fi < segments.length; _fi++) {
      var _fSeg = segments[_fi];
      if (_fSeg.duration < _MIN_FEAT_DURATION) continue;
      var _fType = _fSeg.type || '';
      if (_fType === 'false_start' || _fType === 'retry') continue;

      onProgress('groove', Math.round((_fi / segments.length) * 80));

      // ── Get decoded audio for this segment ────────────────────────────────
      var _segPcm = null;   // Float32Array of mono PCM samples
      var _segSr = 0;       // sample rate of the decoded audio

      if (!isLargeFile && channelData && sampleRate >= 8000) {
        // Normal file: slice directly from in-memory PCM
        var _pStart = Math.floor(_fSeg.startSec * sampleRate);
        var _pDur = Math.min(_fSeg.duration, _SLICE_SEC);
        var _pEnd = Math.min(_pStart + Math.floor(_pDur * sampleRate), channelData.length);
        if (_pEnd - _pStart >= sampleRate * 5) {
          _segPcm = channelData.subarray(_pStart, _pEnd);
          _segSr = sampleRate;
        }
      } else if (isLargeFile && _rawBytes) {
        // Large file: on-demand decode from raw MP3 bytes
        // Calculate byte offset using estimated bitrate, add padding for MP3 frame alignment
        try {
          var _segCenterSec = _fSeg.startSec + Math.max(0, (_fSeg.duration - _SLICE_SEC) / 2);
          var _decStartSec = Math.max(0, _segCenterSec - 2); // 2s padding before
          var _decDurSec = Math.min(_SLICE_SEC + 4, duration - _decStartSec); // +4s padding
          var _byteStart = Math.max(0, Math.floor((_decStartSec * _rawBitrate) / 8));
          var _byteEnd = Math.min(Math.ceil(((_decStartSec + _decDurSec) * _rawBitrate) / 8) + 8192, _rawBytes.byteLength);

          if (_byteEnd - _byteStart > 10000) { // need at least ~10KB
            var _decCtx = new (window.AudioContext || window.webkitAudioContext)();
            try {
              var _decBuf = await _decCtx.decodeAudioData(_rawBytes.slice(_byteStart, _byteEnd));
              // Extract mono channel, trim to target duration
              var _decMono = _decBuf.getChannelData(0);
              var _trimSamples = Math.min(_decMono.length, Math.floor(_SLICE_SEC * _decBuf.sampleRate));
              // Skip the first 2s of padding to get the actual segment audio
              var _skipSamples = Math.floor(2 * _decBuf.sampleRate);
              var _trimStart = Math.min(_skipSamples, _decMono.length - _trimSamples);
              _segPcm = _decMono.subarray(_trimStart, _trimStart + _trimSamples);
              _segSr = _decBuf.sampleRate;
            } catch(_decErr) {
              // MP3 frame boundary issue — try without padding
              console.warn('[Decode] seg ' + _fi + ' chunk decode failed:', _decErr.message);
            }
            _decCtx.close();
          }
        } catch(_byteErr) {
          console.warn('[Decode] seg ' + _fi + ' byte extraction failed:', _byteErr.message);
        }
      }

      if (!_segPcm || _segPcm.length < 1000) continue;

      // ── BPM + Groove extraction ───────────────────────────────────────────
      if (typeof OfflineAnalyser !== 'undefined') {
        try {
          console.log('[BPM] seg ' + _fi + ': PCM=' + _segPcm.length + ' samples, SR=' + _segSr + 'Hz, dur=' + (_segPcm.length / _segSr).toFixed(1) + 's');
          var _gCtx = new (window.AudioContext || window.webkitAudioContext)();
          var _gBuf = _gCtx.createBuffer(1, _segPcm.length, _segSr);
          _gBuf.getChannelData(0).set(_segPcm);
          _gCtx.close();

          var _gAnalyser = new OfflineAnalyser();
          var _gResult = await _gAnalyser.analyseBuffer(_gBuf, 120, 'recording');
          console.log('[BPM] seg ' + _fi + ' result: onsets=' + (_gResult && _gResult.onsets ? _gResult.onsets.length : 0) + ', medianIOI=' + (_gResult && _gResult.metrics ? _gResult.metrics.medianIOI : 'null'));
          if (_gResult && _gResult.metrics && _gResult.metrics.medianIOI > 0) {
            var _m = _gResult.metrics;
            var _rawBpm = Math.round(60000 / _m.medianIOI);
            // BPM correction: live band recordings often detect double-time
            // (snare+kick as separate beats). If BPM > 160, halve it.
            // Most band music is 60-160 BPM; 160-240 is almost always doubled.
            _fSeg.bpm = _rawBpm > 160 ? Math.round(_rawBpm / 2) : _rawBpm;
            _fSeg.bpmConfidence = _m.pocketConfidence || 'low';
            _bpmExtracted++;

            // Build normalized groove object
            var _stabScore = _m.stabilityScore || 0;
            var _pocketMs = _m.pocketPositionMs || 0;
            var _stabLabel = _stabScore >= 80 ? 'Locked in' : _stabScore >= 50 ? 'Getting there' : 'Unsteady';
            var _driftLabel = Math.abs(_pocketMs) < 5 ? 'Centered' : (_pocketMs > 0 ? 'Dragging' : 'Rushing');
            _fSeg.groove = {
              stabilityScore: _stabScore, spacingVarianceMsRaw: _m.spacingVarianceMsRaw || 0,
              pocketPositionMs: _pocketMs, pocketLabel: _m.pocketLabel || 'CENTERED',
              pocketConfidence: _m.pocketConfidence || 'low', iois: _m.iois || [],
              medianIOI: _m.medianIOI, targetBeatMs: _m.targetBeatMs || 500,
              pctInPocket: _m.pctInPocket || 0,
              stability: _stabScore, pocketOffsetMs: Math.round(_pocketMs * 10) / 10,
              stabilityLabel: _stabLabel, drift: _driftLabel,
              label: _stabLabel + ' \u00B7 ' + _driftLabel
            };
            _grooveExtracted++;
            console.log('[Groove] seg ' + _fi + ' (' + _formatTime(_fSeg.startSec) + '-' + _formatTime(_fSeg.endSec) + '): ' +
              _fSeg.bpm + ' BPM, stability=' + _stabScore.toFixed(0) + ', ' + _driftLabel +
              (isLargeFile ? ' [on-demand decode]' : ''));
          }
        } catch(_gErr) {
          console.warn('[Groove] seg ' + _fi + ' failed:', _gErr.message);
        }
      }

      // ── CLAP embedding extraction ─────────────────────────────────────────
      if (_embedServiceAvailable && _fSeg.duration >= _MIN_EMBED_DURATION) {
        try {
          // Use center 30s (or less) for embedding
          var _eCenterLen = Math.min(_segPcm.length, Math.floor(30 * _segSr));
          var _eCenterOff = Math.floor((_segPcm.length - _eCenterLen) / 2);
          var _eSlice = _segPcm.subarray(_eCenterOff, _eCenterOff + _eCenterLen);
          var _eWav = _encodeWAV(_eSlice, _segSr);

          var _eCtrl = new AbortController();
          var _eTimeout = setTimeout(function() { _eCtrl.abort(); }, 8000);
          var _eForm = new FormData();
          _eForm.append('file', new Blob([_eWav], { type: 'audio/wav' }), 'segment.wav');
          var _eRes = await fetch(_embedServiceUrl + '/embed', { method: 'POST', body: _eForm, signal: _eCtrl.signal });
          clearTimeout(_eTimeout);
          var _eData = await _eRes.json();

          if (_eData.embedding && _eData.embedding.length) {
            _fSeg.audioEmbedding = _eData.embedding;
            _embedsExtracted++;
            console.log('[Embed] seg ' + _fi + ': ' + _eData.dimension + 'd' + (isLargeFile ? ' [on-demand decode]' : ''));
          }
        } catch(_eErr) {
          if (_eErr.name === 'AbortError') {
            console.warn('[Embed] Service timeout — stopping embedding extraction');
            _embedServiceAvailable = false; // don't try remaining segments
          } else {
            console.warn('[Embed] seg ' + _fi + ' failed:', _eErr.message);
          }
        }
      }

      // ── Chord detection (Essentia) ──────────────────────────────────────────
      if (_chordServiceAvailable && _fSeg.duration >= _MIN_EMBED_DURATION && !_fSeg.chordHints) {
        try {
          var _cWav = _encodeWAV(_segPcm, _segSr);
          var _cCtrl = new AbortController();
          var _cTimeout = setTimeout(function() { _cCtrl.abort(); }, 10000); // chords take longer
          var _cForm = new FormData();
          _cForm.append('file', new Blob([_cWav], { type: 'audio/wav' }), 'segment.wav');
          _cForm.append('segment_id', _fSeg.id || ('seg_' + _fi));
          _cForm.append('song_name', _fSeg.songTitle || '');
          _cForm.append('segment_type', 'song');
          _cForm.append('duration_sec', String(Math.round(_fSeg.duration)));
          var _cRes = await fetch(_chordServiceUrl + '/analyze-chords', { method: 'POST', body: _cForm, signal: _cCtrl.signal });
          clearTimeout(_cTimeout);
          var _cData = await _cRes.json();

          if (_cData && !_cData.error) {
            _fSeg.chordHints = _cData;
            _fSeg._chordCacheKey = (_fSeg.id || '') + '|' + _fSeg.startSec.toFixed(1) + '|' + _fSeg.endSec.toFixed(1);
            _chordsExtracted++;
            var _cSummary = _cData.summary;
            var _cProg = _cSummary && _cSummary.topProgressionHint ? _cSummary.topProgressionHint : '(no progression)';
            var _cTop = _cSummary && _cSummary.topChords ? _cSummary.topChords.join(',') : '';
            console.log('[Chords] seg ' + _fi + ' (' + _formatTime(_fSeg.startSec) + '-' + _formatTime(_fSeg.endSec) + '): ' +
              _cProg + ' [' + _cTop + '] conf=' + (_cData.confidence || '?') +
              (isLargeFile ? ' [on-demand decode]' : ''));
          }
        } catch(_cErr) {
          if (_cErr.name === 'AbortError') {
            console.warn('[Chords] Service timeout — stopping chord extraction');
            _chordServiceAvailable = false;
          } else {
            console.warn('[Chords] seg ' + _fi + ' failed:', _cErr.message);
          }
        }
      }
    }

    // NOTE: _rawBytes NOT released yet — transcription stage needs it for large-file talk segments

    console.log('[RecordingAnalyzer] Feature extraction complete: BPM=' + _bpmExtracted +
      ' Groove=' + _grooveExtracted + ' Embed=' + _embedsExtracted +
      ' Chords=' + _chordsExtracted + ' / ' + segments.length + ' segments');

    // ── Stage 3c: Spoken cue transcription ──────────────────────────────────
    // Transcribe short talking segments adjacent to song segments to detect
    // spoken song announcements ("let's do Fire", "Estimated again").
    // Also transcribe short vocal windows from song segments for lyric matching.
    var _talksTranscribed = 0;
    var _lyricsExtracted = 0;
    var _cuesDetected = 0;
    var _workerUrl = (typeof WORKER_URL !== 'undefined') ? WORKER_URL : 'https://groovelinx-worker.drewmerrill.workers.dev';
    var _transcribeAvailable = true; // assume available, fail gracefully
    var _MIN_TALK_DURATION = 3;  // minimum talking segment for transcription
    var _MAX_TALK_DURATION = 60; // don't transcribe very long discussions
    var _MIN_LYRIC_DURATION = 60; // minimum song duration for lyric extraction
    var _LYRIC_WINDOW_SEC = 15;   // transcribe 15s from song center for lyrics

    // Build song title index for cue matching
    var _titleIndex = {};
    songCatalog.forEach(function(s) {
      if (!s.title) return;
      var lower = s.title.toLowerCase();
      _titleIndex[lower] = s.title;
      // Also index significant words (≥4 chars) for partial matches
      lower.split(/\s+/).forEach(function(w) {
        if (w.length >= 4 && w !== 'the' && w !== 'this' && w !== 'that' && w !== 'with' && w !== 'from') {
          if (!_titleIndex['_word_' + w]) _titleIndex['_word_' + w] = [];
          if (Array.isArray(_titleIndex['_word_' + w])) _titleIndex['_word_' + w].push(s.title);
        }
      });
    });

    // Helper: extract spoken cues from transcript text
    function _extractSpokenCues(text) {
      if (!text || text.length < 3) return [];
      var lower = text.toLowerCase();
      var cues = [];

      // Direct title match (full title appears in speech)
      Object.keys(_titleIndex).forEach(function(key) {
        if (key.charAt(0) === '_') return; // skip word index entries
        if (lower.indexOf(key) !== -1) {
          cues.push({ title: _titleIndex[key], type: 'title_mention', confidence: 0.85 });
        }
      });

      // Cue pattern detection: "let's do/play/try [song]", "back to [song]", etc.
      var cuePatterns = [
        /(?:let's|lets|let us)\s+(?:do|play|try|run|start|hit)\s+(.{3,30}?)(?:\s+again|\s+now|\s*[.!?]|$)/i,
        /(?:back to|go to|jump to|switch to)\s+(.{3,30}?)(?:\s+again|\s*[.!?]|$)/i,
        /(?:next up|next is|how about)\s+(.{3,30}?)(?:\s*[.!?]|$)/i,
        /(?:one more time|again|from the top)\s*[,.]?\s*(.{3,20}?)(?:\s*[.!?]|$)/i
      ];
      cuePatterns.forEach(function(pat) {
        var match = lower.match(pat);
        if (match && match[1]) {
          var phrase = match[1].trim().replace(/[.!?,;:]+$/, '');
          // Try to match phrase against catalog
          var bestMatch = _fuzzyMatchTitle(phrase, songCatalog);
          if (bestMatch) {
            cues.push({ title: bestMatch, type: 'cue_pattern', confidence: 0.7, phrase: phrase });
          }
        }
      });

      return cues;
    }

    // Fuzzy title matching: find best catalog match for a spoken phrase
    function _fuzzyMatchTitle(phrase, catalog) {
      if (!phrase || phrase.length < 3) return null;
      var lower = phrase.toLowerCase();
      var bestTitle = null;
      var bestScore = 0;

      catalog.forEach(function(s) {
        if (!s.title) return;
        var titleLower = s.title.toLowerCase();
        // Exact containment
        if (titleLower.indexOf(lower) !== -1 || lower.indexOf(titleLower) !== -1) {
          var score = Math.min(lower.length, titleLower.length) / Math.max(lower.length, titleLower.length);
          if (score > bestScore) { bestScore = score; bestTitle = s.title; }
          return;
        }
        // Word overlap: count shared significant words
        var phraseWords = lower.split(/\s+/).filter(function(w) { return w.length >= 3; });
        var titleWords = titleLower.split(/\s+/).filter(function(w) { return w.length >= 3; });
        var overlap = phraseWords.filter(function(w) { return titleWords.indexOf(w) !== -1; }).length;
        if (overlap >= 1 && titleWords.length <= 4) {
          var score2 = overlap / Math.max(phraseWords.length, titleWords.length) * 0.8;
          if (score2 > bestScore) { bestScore = score2; bestTitle = s.title; }
        }
      });

      return bestScore >= 0.4 ? bestTitle : null;
    }

    // Transcribe talking segments adjacent to song segments
    if (_talkSegments.length > 0 && channelData && (sampleRate >= 8000 || _rawBytes)) {
      console.log('[Transcribe] Found ' + _talkSegments.length + ' talking segments — transcribing for spoken cues');

      for (var _ti = 0; _ti < _talkSegments.length && _transcribeAvailable; _ti++) {
        var _tSeg = _talkSegments[_ti];
        if (_tSeg.duration < _MIN_TALK_DURATION || _tSeg.duration > _MAX_TALK_DURATION) continue;

        onProgress('groove', 80 + Math.round((_ti / _talkSegments.length) * 10));

        try {
          // Get audio for this talking segment (same on-demand decode pattern as feature extraction)
          var _tPcm = null, _tSr = 0;
          if (!isLargeFile && channelData && sampleRate >= 8000) {
            var _tStart = Math.floor(_tSeg.startSec * sampleRate);
            var _tEnd = Math.min(Math.floor(_tSeg.endSec * sampleRate), channelData.length);
            if (_tEnd - _tStart >= sampleRate) {
              _tPcm = channelData.subarray(_tStart, _tEnd);
              _tSr = sampleRate;
            }
          } else if (isLargeFile && _rawBytes) {
            // Large file: on-demand decode from raw MP3 bytes
            try {
              var _tByteStart = Math.max(0, Math.floor((_tSeg.startSec * _rawBitrate) / 8) - 4096);
              var _tByteEnd = Math.min(Math.ceil((_tSeg.endSec * _rawBitrate) / 8) + 4096, _rawBytes.byteLength);
              if (_tByteEnd - _tByteStart > 5000) {
                var _tDecCtx = new (window.AudioContext || window.webkitAudioContext)();
                var _tDecBuf = await _tDecCtx.decodeAudioData(_rawBytes.slice(_tByteStart, _tByteEnd));
                _tPcm = _tDecBuf.getChannelData(0);
                _tSr = _tDecBuf.sampleRate;
                _tDecCtx.close();
              }
            } catch(_tDecErr) {
              console.warn('[Transcribe] talk seg ' + _ti + ' decode failed:', _tDecErr.message);
            }
          }
          if (!_tPcm) continue;

          var _tWav = _encodeWAV(_tPcm, _tSr);
          var _tCtrl = new AbortController();
          var _tTimeout = setTimeout(function() { _tCtrl.abort(); }, 15000);
          var _tRes = await fetch(_workerUrl + '/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: _tWav,
            signal: _tCtrl.signal
          });
          clearTimeout(_tTimeout);
          var _tData = await _tRes.json();

          if (_tData.error) {
            console.warn('[Transcribe] talk seg ' + _ti + ' error:', _tData.error);
            if (_tData.error.indexOf('not configured') !== -1) {
              _transcribeAvailable = false; // Deepgram not set up
              console.warn('[Transcribe] Deepgram not configured — skipping all transcription');
            }
            continue;
          }

          if (_tData.transcript && _tData.transcript.length > 2) {
            _tSeg.transcript = _tData.transcript;
            _talksTranscribed++;

            // Extract spoken cues
            var cues = _extractSpokenCues(_tData.transcript);
            if (cues.length > 0) {
              _cuesDetected += cues.length;
              // Find the next song segment after this talking segment
              var _nextSong = null;
              for (var _ns = 0; _ns < segments.length; _ns++) {
                if (segments[_ns].startSec >= _tSeg.endSec - 5) { _nextSong = segments[_ns]; break; }
              }
              // Also check previous song (might be re-doing the same one)
              var _prevSong = null;
              for (var _ps = segments.length - 1; _ps >= 0; _ps--) {
                if (segments[_ps].endSec <= _tSeg.startSec + 5) { _prevSong = segments[_ps]; break; }
              }

              var bestCue = cues.sort(function(a, b) { return b.confidence - a.confidence; })[0];
              console.log('[SpokenCue] "' + _tData.transcript.slice(0, 60) + '" → ' +
                bestCue.title + ' (conf=' + bestCue.confidence + ', type=' + bestCue.type + ')');

              // Propagate to adjacent song segment
              var _target = _nextSong || _prevSong;
              if (_target) {
                _target.spokenCueHint = bestCue.title;
                _target.spokenCueConfidence = bestCue.confidence;
                _target.spokenCueTranscript = _tData.transcript;
                // Also set transcript so lyricsMatch signal can use it
                if (!_target.transcript) _target.transcript = _tData.transcript;
              }
            } else {
              console.log('[Transcribe] talk seg ' + _ti + ' (' + _formatTime(_tSeg.startSec) + '): "' +
                _tData.transcript.slice(0, 50) + '" (no song cue detected)');
            }
          }
        } catch(_tErr) {
          if (_tErr.name === 'AbortError') {
            console.warn('[Transcribe] Timeout — stopping transcription');
            _transcribeAvailable = false;
          } else {
            console.warn('[Transcribe] talk seg ' + _ti + ' failed:', _tErr.message);
          }
        }
      }
    }

    // Lyric snippets: transcribe short vocal windows from low-confidence song segments
    if (_transcribeAvailable && !isLargeFile && channelData && sampleRate >= 8000) {
      for (var _li = 0; _li < segments.length && _transcribeAvailable; _li++) {
        var _lSeg = segments[_li];
        if (_lSeg.duration < _MIN_LYRIC_DURATION) continue;
        if (_lSeg.transcript) continue; // already has transcript from spoken cue
        var _lType = _lSeg.type || '';
        if (_lType === 'false_start' || _lType === 'retry') continue;

        // Only transcribe segments without a strong match yet
        // (we'll check confidence later, but at this point matching hasn't run,
        // so we prioritize longer segments that are likely full songs)
        if (_lSeg.duration < 120) continue; // only full-length songs

        onProgress('groove', 90 + Math.round((_li / segments.length) * 10));

        try {
          // Extract 15s from the center of the song (more likely to have clear vocals)
          var _lCenter = _lSeg.startSec + (_lSeg.duration / 2);
          var _lStart = Math.floor((_lCenter - _LYRIC_WINDOW_SEC / 2) * sampleRate);
          var _lEnd = Math.min(_lStart + Math.floor(_LYRIC_WINDOW_SEC * sampleRate), channelData.length);
          _lStart = Math.max(0, _lStart);
          if (_lEnd - _lStart < sampleRate * 3) continue;

          var _lPcm = channelData.subarray(_lStart, _lEnd);
          var _lWav = _encodeWAV(_lPcm, sampleRate);
          var _lCtrl = new AbortController();
          var _lTimeout = setTimeout(function() { _lCtrl.abort(); }, 15000);
          var _lRes = await fetch(_workerUrl + '/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/wav' },
            body: _lWav,
            signal: _lCtrl.signal
          });
          clearTimeout(_lTimeout);
          var _lData = await _lRes.json();

          if (!_lData.error && _lData.transcript && _lData.transcript.length > 10) {
            _lSeg.lyricSnippet = _lData.transcript;
            _lSeg.lyricConfidence = _lData.confidence || 0;
            // Also set transcript for lyricsMatch signal
            if (!_lSeg.transcript) _lSeg.transcript = _lData.transcript;
            _lyricsExtracted++;
            console.log('[Lyrics] seg ' + _li + ' (' + _formatTime(_lSeg.startSec) + '): "' +
              _lData.transcript.slice(0, 60) + '..." (conf=' + (_lData.confidence || 0).toFixed(2) + ')');
          }
        } catch(_lErr) {
          if (_lErr.name === 'AbortError') {
            console.warn('[Lyrics] Timeout — stopping lyric extraction');
            _transcribeAvailable = false;
          } else {
            console.warn('[Lyrics] seg ' + _li + ' failed:', _lErr.message);
          }
        }
      }
    }

    console.log('[RecordingAnalyzer] Transcription: talks=' + _talksTranscribed +
      ' cues=' + _cuesDetected + ' lyrics=' + _lyricsExtracted);

    // Release raw bytes now that all extraction + transcription is done
    _rawBytes = null;
    onProgress('groove', 100);

    // Stage 4: Song matching
    onProgress('matching', 0);

    // Preload chart fingerprints for chord-to-chart matching
    if (typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.preloadChartFingerprints) {
      await SongMatchingEngine.preloadChartFingerprints();
    }

    // Run Song Matching Engine (multi-signal scoring)
    if (typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.run) {
      var _refSongs = (_recordingContext && _recordingContext.referenceSongs) || [];
      console.log('[RecordingAnalyzer] Matching context: type=' + ((_recordingContext && _recordingContext.type) || '?') +
        ', referenceSongs=' + _refSongs.length + (_refSongs.length > 0 ? ' [' + _refSongs.slice(0, 5).join(', ') + '...]' : ' (EMPTY — no plan songs for matching)') +
        ', catalog=' + songCatalog.length + ' songs');
      // Gather recent rehearsal history for candidate prioritization
      var _recentSessionSongs = [];
      try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
          var _sessSnap = await firebaseDB.ref(bandPath('rehearsal_sessions')).orderByChild('date').limitToLast(5).once('value');
          var _sessVal = _sessSnap.val();
          if (_sessVal) {
            var _sessArr = Object.values(_sessVal).sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
            var _recentSet = {};
            _sessArr.forEach(function(s) {
              (s.songsWorked || []).forEach(function(t) { if (t && !_recentSet[t]) { _recentSet[t] = true; _recentSessionSongs.push(t); } });
            });
          }
        }
      } catch(e) {}
      if (_recentSessionSongs.length) console.log('[RecordingAnalyzer] Recent rehearsal songs: ' + _recentSessionSongs.length + ' [' + _recentSessionSongs.slice(0, 5).join(', ') + '...]');

      var matchContext = {
        type: (_recordingContext && _recordingContext.type) || 'rehearsal',
        referenceSongs: _refSongs,
        recentSessionSongs: _recentSessionSongs,
        allSongs: songCatalog
      };
      segments = SongMatchingEngine.run(segments, matchContext);

      // Debug: log matching results with BPM data
      console.log('[RecordingAnalyzer] === MATCHING RESULTS ===');
      segments.forEach(function(seg, idx) {
        var bpmStr = seg.bpm ? (seg.bpm + ' BPM') : '-';
        var embedStr = seg.audioEmbedding ? (seg.audioEmbedding.length + 'd') : '-';
        var chordStr = seg.chordHints && seg.chordHints.usable ? (seg.chordHints.confidence || '?') : '-';
        var cueStr = seg.spokenCueHint ? ('cue:"' + seg.spokenCueHint + '"') : (seg.lyricSnippet ? 'lyrics' : '-');
        var matchStr = seg.songMatch ? (seg.songMatch.confidence + ' [' + (seg.songMatch.activeSignals || []).join('+') + ']') : 'no match';
        var topCands = seg.songMatch && seg.songMatch.candidates ? seg.songMatch.candidates.map(function(c) { return c.title + '(' + c.score + ')'; }).join(', ') : '';
        console.log('[Match] #' + idx + ' ' + _formatTime(seg.startSec) + '-' + _formatTime(seg.endSec) +
          ' | ' + bpmStr + ' | chords:' + chordStr + ' | embed:' + embedStr + ' | ' + cueStr +
          ' | → ' + (seg.songTitle || '?') + ' | ' + matchStr +
          (topCands ? ' | ' + topCands : ''));
      });
    } else {
      // Fallback: use legacy plan-order matching
      segments.forEach(function(seg, i) {
        if (!seg.songTitle) seg.songTitle = _guessSong({}, i, songCatalog);
      });
    }

    // ── Auto-split oversized segments using energy dips ──────────────────────
    // A 130-minute "song" is clearly multiple songs. Find internal energy
    // drops and split into sub-segments. Uses the RMS channelData.
    var MAX_SONG_DURATION = 600; // 10 minutes — anything longer gets auto-split (was 15)
    if (channelData && sampleRate) {
      var _splitSegments = [];
      segments.forEach(function(seg) {
        if (seg.duration <= MAX_SONG_DURATION) {
          _splitSegments.push(seg);
          return;
        }
        // This segment is too long — find internal energy dips to split on
        var subSegs = _splitOversizedSegment(seg, channelData, sampleRate);
        subSegs.forEach(function(s) { _splitSegments.push(s); });
      });
      if (_splitSegments.length > segments.length) {
        console.log('[RecordingAnalyzer] Auto-split oversized: ' + segments.length + ' → ' + _splitSegments.length + ' segments');
        segments = _splitSegments;
      }
    }

    // ── Duration sanity check: flag segments that are impossibly long ──
    segments.forEach(function(seg) {
      if (seg.duration > MAX_SONG_DURATION && seg.songTitle) {
        seg._oversized = true;
        seg.confidence = Math.min(seg.confidence || 1, 0.2);
        console.warn('[RecordingAnalyzer] Oversized segment: ' + seg.songTitle + ' (' + Math.round(seg.duration / 60) + 'min) — likely multiple songs');
      }
    });

    // ── Apply saved user overrides from previous analyses ──
    _applyUserOverrides(segments, opts.sessionId);

    // ── Post-match: merge adjacent same-song segments ──────────────────────────
    // If two adjacent segments got the same song label (or one is unlabeled),
    // and the gap between them is small, merge them into one segment.
    if (segments.length > 1) {
      var _merged = [segments[0]];
      for (var mi = 1; mi < segments.length; mi++) {
        var prev = _merged[_merged.length - 1];
        var curr = segments[mi];
        var gap = curr.startSec - prev.endSec;
        var sameLabel = prev.songTitle && curr.songTitle && prev.songTitle === curr.songTitle;
        var oneUnlabeled = (!curr.songTitle || curr.songTitle.indexOf('Song ') === 0) && prev.songTitle;

        // Merge if: same song OR one unlabeled + gap < 20s
        if ((sameLabel || oneUnlabeled) && gap < 20) {
          prev.endSec = curr.endSec;
          prev.duration = prev.endSec - prev.startSec;
          if (oneUnlabeled && !sameLabel) {
            // Keep the labeled segment's title
          }
          console.log('[RecordingAnalyzer] Merged segments: ' + prev.songTitle + ' (' + _formatTime(prev.startSec) + '-' + _formatTime(prev.endSec) + ')');
        } else {
          _merged.push(curr);
        }
      }
      if (_merged.length < segments.length) {
        console.log('[RecordingAnalyzer] Post-match merge: ' + segments.length + ' → ' + _merged.length + ' segments');
        segments = _merged;
      }
    }

    // ── Post-match: validate labels using BPM when available ─────────────────
    // If a segment has groove data (BPM) and the assigned song has a known BPM,
    // check if they're wildly different. If so, look for a better candidate.
    segments.forEach(function(seg) {
      if (!seg.songTitle || !seg.groove) return;
      var song = songCatalog.find(function(s) { return s.title === seg.songTitle; });
      if (!song || !song.bpm) return;

      // Estimate BPM from groove median IOI if available
      var segBpm = seg.bpm || (seg.groove && seg.groove.pocketOffsetMs ? 60000 / (500 + seg.groove.pocketOffsetMs) : 0);
      if (!segBpm) return;

      var diff = Math.abs(segBpm - song.bpm) / song.bpm;
      if (diff > 0.30) { // >30% BPM mismatch — likely wrong song
        seg._bpmMismatch = true;
        seg.confidence = Math.min(seg.confidence || 1, 0.3);
        if (seg.songMatch) {
          seg.songMatch.confidence = 'low';
          seg.songMatch.needsReview = true;
          seg.songMatch.explanation = seg.songMatch.explanation || [];
          seg.songMatch.explanation.push('BPM mismatch: segment ~' + Math.round(segBpm) + ' vs song ' + song.bpm);
        }
        console.log('[RecordingAnalyzer] BPM mismatch: ' + seg.songTitle + ' (seg ~' + Math.round(segBpm) + ' vs song ' + song.bpm + ')');
      }
    });

    // Label segments without song matches + compute quality scores
    var songNum = 1;
    segments.forEach(function(seg) {
      if (!seg.songTitle && seg.duration >= 60) {
        seg.songTitle = 'Song ' + songNum;
        seg.confidence = 0.1;
        songNum++;
      }
      if (!seg.segType) seg.segType = 'song';

      // Quality score + label + explanation
      var q = 0;
      var qWhy = '';
      if (seg.type === 'song_full' || seg.duration >= 120) { q += 3; qWhy = 'Full-length attempt'; }
      else if (seg.type === 'song_partial' || seg.duration >= 30) { q += 2; qWhy = 'Partial attempt'; }
      else { q += 1; qWhy = 'Short attempt'; }
      if (seg.type === 'false_start' || seg.type === 'retry') { q = 1; qWhy = 'Early stop'; }
      if (seg.tags && seg.tags.indexOf('strong_moment') !== -1) { q += 1; qWhy += ' with stable energy'; }
      // Groove-informed quality: upgrade/downgrade based on actual timing data
      if (seg.groove && typeof seg.groove.stability === 'number') {
        if (seg.groove.stability >= 80) { q += 1; qWhy += ' + tight timing'; }
        else if (seg.groove.stability < 40 && q >= 3) { q -= 1; qWhy += ' but timing was loose'; }
      }
      seg.qualityScore = Math.min(q, 5);
      seg.qualityLabel = q >= 5 ? 'Nailed it' : q >= 4 ? 'Strong finish' : q >= 3 ? 'Solid run' : q >= 2 ? 'Needs another pass' : 'Incomplete';
      seg.qualityWhy = qWhy;
      // Duration context label
      seg.durContext = seg.type === 'false_start' ? 'false start' : (seg.duration >= 120 ? 'full run' : (seg.duration >= 30 ? 'partial' : 'fragment'));
    });

    // Per-segment groove is now computed inline during BPM extraction (Stage 3 above).
    // The groove object includes both GrooveAnalyser native fields (for PocketMeterTimeSeries)
    // and UI-expected fields (stability, label, drift) for rehearsal.js rendering.

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
      grooveMetrics: null, // groove metrics are now per-segment (seg.groove)
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
    var _matchSource = _recordingContext ? (_recordingContext.type === 'rehearsal' ? 'Matched from rehearsal plan' : _recordingContext.type === 'gig' ? 'Matched from setlist' : 'Single song focus') : 'Matched from catalog';
    var _summaryParts = [_currentSegments.length + ' segments'];
    if (durLabel) _summaryParts[0] += ' \u00B7 ' + durLabel;
    _summaryParts.push(_songs + ' songs');
    if (_needsReview > 0) _summaryParts.push(_needsReview + ' to confirm');
    if (_planVsActual && _planVsActual.missing.length > 0) _summaryParts.push(_planVsActual.missing.length + ' missing from plan');

    var _segTypes = [['song','Song'],['restart','Restart'],['talking','Talking'],['jam','Jam / Improv'],['ignore','Ignore']];
    var _confirmed = _currentSegments.filter(function(s) { return s.confirmed; }).length;
    var _allConfirmed = _confirmed >= _currentSegments.length;

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<div>'
      + '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9)">Recording Analysis</div>'
      + '<div style="font-size:0.7em;color:var(--text-dim,#475569)">' + _summaryParts.join(' \u00B7 ') + '</div>'
      + '<div style="font-size:0.62em;color:var(--text-dim);margin-top:2px">' + _matchSource + ' \u00B7 review to confirm song names</div>'
      + '<div style="font-size:0.65em;color:' + (_allConfirmed ? '#10b981' : 'var(--text-dim)') + ';margin-top:1px">' + _confirmed + '/' + _currentSegments.length + ' reviewed' + (_allConfirmed ? ' \u2713' : '') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + (_needsReview > 0 ? '<button onclick="RecordingAnalyzer._jumpToNextReview()" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);color:#f87171;cursor:pointer;font-weight:600">Next to review \u25BC</button>' : '')
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1em;cursor:pointer">\u2715</button>'
      + '</div></div>';

    // No-plan warning
    if (_recordingContext && _recordingContext.noPlan) {
      html += '<div style="padding:6px 10px;margin-bottom:8px;border-radius:6px;border:1px solid rgba(245,158,11,0.15);background:rgba(245,158,11,0.04);font-size:0.7em;color:#fbbf24">No rehearsal plan linked \u2014 song matching may be less accurate</div>';
    }

    // Compute time per song
    var _songTime = {};
    _currentSegments.forEach(function(s) {
      if (s.songTitle && s.segType !== 'ignore' && s.segType !== 'talking') {
        _songTime[s.songTitle] = (_songTime[s.songTitle] || 0) + (s.duration || 0);
      }
    });
    var _totalMusicTime = Object.values(_songTime).reduce(function(a, b) { return a + b; }, 0);

    // Plan vs Actual (collapsed — compact summary visible, detail on expand)
    if (_planVsActual) {
      var pva = _planVsActual;
      var _pvaSummary = pva.played.length + '/' + pva.planned.length + ' played';
      if (pva.missing.length) _pvaSummary += ' \u00B7 ' + pva.missing.length + ' missing';
      if (pva.unplanned.length) _pvaSummary += ' \u00B7 ' + pva.unplanned.length + ' unplanned';
      var pvaHtml = '<details style="margin-bottom:10px;border-radius:8px;font-size:0.72em;'
        + (pva.missing.length > 0 ? 'border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04)' : 'border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.04)')
        + '"><summary style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;list-style:none">'
        + '<span style="font-weight:700;color:var(--text-muted)">Plan vs Actual</span>'
        + '<span style="color:' + (pva.missing.length ? '#fbbf24' : '#10b981') + '">' + _pvaSummary + '</span>'
        + '</summary><div style="padding:4px 10px 10px">';
      pvaHtml += '<span style="color:#10b981">' + pva.played.length + '/' + pva.planned.length + ' played</span>';

      // Repeated songs with time (clickable → jump between attempts)
      if (pva.repeated.length) {
        pvaHtml += '<div style="margin-top:4px">';
        pva.repeated.forEach(function(r) {
          var timeMin = Math.round((_songTime[r.title] || 0) / 60);
          pvaHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
            + '<span onclick="RecordingAnalyzer._jumpToSong(\'' + _escAttr(r.title) + '\')" style="color:var(--text);cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px">' + _escAttr(r.title) + ' \u00D7' + r.attempts + '</span>'
            + '<span style="color:var(--text-dim)">' + timeMin + ' min</span>'
            + '</div>';
        });
        pvaHtml += '</div>';
      }

      // Missing songs (clickable actions)
      if (pva.missing.length) {
        pvaHtml += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">';
        pvaHtml += '<div style="color:#fbbf24;font-weight:600;margin-bottom:3px">Missing from plan:</div>';
        pva.missing.forEach(function(song) {
          pvaHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
            + '<span style="color:var(--text)">' + _escAttr(song) + '</span>'
            + '<button onclick="RecordingAnalyzer._addToNextPlan(\'' + _escAttr(song) + '\')" style="font-size:0.85em;padding:1px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:none;color:#818cf8;cursor:pointer" title="Add to next rehearsal">+ next plan</button>'
            + '<button onclick="this.parentElement.style.opacity=\'0.3\';this.disabled=true" style="font-size:0.85em;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer" title="Intentionally skipped">skipped</button>'
            + '</div>';
        });
        pvaHtml += '</div>';
      }

      // Unplanned songs (clickable → jump + actions)
      if (pva.unplanned.length) {
        pvaHtml += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">';
        pvaHtml += '<div style="color:#818cf8;font-weight:600;margin-bottom:3px">Not in plan:</div>';
        pva.unplanned.forEach(function(song) {
          pvaHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0">'
            + '<span onclick="RecordingAnalyzer._jumpToSong(\'' + _escAttr(song) + '\')" style="color:var(--text);cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px">' + _escAttr(song) + '</span>'
            + '<button onclick="RecordingAnalyzer._addToNextPlan(\'' + _escAttr(song) + '\')" style="font-size:0.85em;padding:1px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:none;color:#818cf8;cursor:pointer">+ next plan</button>'
            + '<button onclick="this.parentElement.style.opacity=\'0.3\';this.disabled=true" style="font-size:0.85em;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer">ignore</button>'
            + '</div>';
        });
        pvaHtml += '</div>';
      }

      pvaHtml += '</div></details>';
      html += pvaHtml;
    }

    // Behavior insights (1-2 lines, only when meaningful)
    var _insights = _buildBehaviorInsights(_songTime, _totalMusicTime);
    if (_insights.length) {
      html += '<div style="padding:6px 10px;margin-bottom:10px;font-size:0.7em;color:var(--text-dim);border-left:3px solid rgba(99,102,241,0.3)">';
      _insights.forEach(function(ins) { html += '<div style="padding:1px 0">' + ins + '</div>'; });
      html += '</div>';
    }

    // Practice mode metrics (if applicable)
    if (_recordingContext && _recordingContext.type === 'practice') {
      var _practiceSegs = _currentSegments.filter(function(s) { return s.segType !== 'ignore' && s.segType !== 'talking'; });
      var _longestRun = 0;
      _practiceSegs.forEach(function(s) { if (s.duration > _longestRun) _longestRun = s.duration; });
      html += '<div style="display:flex;gap:12px;padding:8px 10px;margin-bottom:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);font-size:0.72em">'
        + '<div style="text-align:center;flex:1"><div style="font-weight:700;color:var(--text)">' + Math.round(_totalMusicTime / 60) + 'm</div><div style="color:var(--text-dim)">practice time</div></div>'
        + '<div style="text-align:center;flex:1"><div style="font-weight:700;color:var(--text)">' + _practiceSegs.length + '</div><div style="color:var(--text-dim)">run-throughs</div></div>'
        + '<div style="text-align:center;flex:1"><div style="font-weight:700;color:var(--text)">' + Math.round(_longestRun / 60) + 'm</div><div style="color:var(--text-dim)">longest run</div></div>'
        + '</div>';
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
        + '<div style="font-size:0.65em;color:var(--text-dim);min-width:85px;flex-shrink:0">'
        + _formatTime(seg.startSec) + '\u2013' + _formatTime(seg.endSec)
        + '<br>' + durLabel2 + (seg.durContext ? ' \u00B7 ' + seg.durContext : '')
        + (seg.qualityLabel && segTypeVal === 'song' && (seg.groove || seg.qualityScore >= 3) ? '<br><span style="color:' + (seg.qualityScore >= 3 ? '#10b981' : seg.qualityScore >= 2 ? '#f59e0b' : '#64748b') + '" title="' + _escAttr(seg.qualityWhy || '') + '">' + seg.qualityLabel + '</span>' : '')
        + (seg.groove ? '<br><span style="color:' + (seg.groove.stability >= 80 ? '#10b981' : seg.groove.stability >= 50 ? '#f59e0b' : '#ef4444') + '" title="Stability: ' + seg.groove.stability + '% \u00B7 Pocket: ' + seg.groove.pctInPocket + '%">' + seg.groove.label + '</span>' : '')
        + (seg.improvementNote ? '<br><span style="color:#818cf8;font-style:italic">' + seg.improvementNote + '</span>' : '')
        + '</div>'
        + '<input type="text" value="' + _escAttr(seg.displayTitle || '') + '" onchange="RecordingAnalyzer._updateSegTitle(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 6px;color:var(--text,#f1f5f9);font-size:0.78em;font-family:inherit;min-width:0" placeholder="Song name...">'
        // Candidate dropdown + confidence indicator (from SongMatchingEngine)
        + (seg.songMatch && seg.songMatch.candidates && seg.songMatch.candidates.length > 1
          ? '<select onchange="RecordingAnalyzer._updateSegTitle(' + i + ',this.value)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:2px 3px;color:var(--text-dim);font-size:0.6em;flex-shrink:0;font-family:inherit;max-width:70px">'
            + seg.songMatch.candidates.map(function(c) { return '<option value="' + _escAttr(c.title) + '"' + (c.title === seg.songTitle ? ' selected' : '') + '>' + _escAttr(c.title.length > 15 ? c.title.slice(0, 15) + '\u2026' : c.title) + '</option>'; }).join('')
            + '</select>'
          : '')
        + (seg.songMatch && seg.songMatch.explanation && seg.songMatch.explanation.length
          ? '<span title="' + _escAttr('Confidence: ' + seg.songMatch.confidence + (seg.songMatch.limitedEvidence ? ' (limited evidence)' : '') + (seg.songMatch.activeSignals ? ' \u00B7 Signals: ' + seg.songMatch.activeSignals.join(', ') : '') + '\n' + seg.songMatch.explanation.join(' \u00B7 ')) + '" style="font-size:0.55em;color:' + (seg.songMatch.confidence === 'high' ? '#10b981' : seg.songMatch.confidence === 'medium' ? '#f59e0b' : '#64748b') + ';cursor:help;flex-shrink:0">' + (seg.songMatch.limitedEvidence ? 'limited' : 'why?') + '</span>'
          : '')
        + '<select onchange="RecordingAnalyzer._updateSegType(' + i + ',this.value)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:3px 4px;color:var(--text-dim);font-size:0.65em;flex-shrink:0;font-family:inherit">'
        + _segTypes.map(function(t) { return '<option value="' + t[0] + '"' + (t[0] === segTypeVal ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('')
        + '</select>'
        // Row 1 actions: confirm + merge + remove
        + '<button onclick="RecordingAnalyzer._confirmSeg(' + i + ')" id="raConfBtn' + i + '" style="background:none;border:1px solid ' + (seg.confirmed ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)') + ';color:' + (seg.confirmed ? '#10b981' : '#475569') + ';cursor:pointer;font-size:0.6em;flex-shrink:0;padding:1px 5px;border-radius:4px" title="Confirm">' + (seg.confirmed ? '\u2713' : '\u2713') + '</button>'
        + '<button onclick="RecordingAnalyzer._mergeWithPrev(' + i + ')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.6em;flex-shrink:0;padding:2px" title="Merge with previous"' + (i === 0 ? ' disabled style="opacity:0.3"' : '') + '>\u2B06\uFE0F</button>'
        + '<button onclick="RecordingAnalyzer._removeSegment(' + i + ')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.72em;flex-shrink:0;padding:2px" title="Remove">\u2715</button>'
        + '</div>';

      // Row 2: playback controls (collapsed to keep rows compact)
      var _tinyBtn = 'background:none;border:1px solid rgba(255,255,255,0.06);color:var(--text-dim);cursor:pointer;font-size:0.6em;padding:1px 4px;border-radius:3px;font-family:inherit';
      html += '<details style="margin-top:3px"><summary style="font-size:0.55em;color:var(--text-dim);cursor:pointer;list-style:none;user-select:none">controls \u25B8</summary>'
        + '<div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap">'
        + '<button onclick="RecordingAnalyzer._seekSeg(' + i + ',-10)" style="' + _tinyBtn + '">-10s</button>'
        + '<button onclick="RecordingAnalyzer._seekSeg(' + i + ',10)" style="' + _tinyBtn + '">+10s</button>'
        + '<span style="width:1px;height:12px;background:rgba(255,255,255,0.06);margin:0 2px"></span>'
        + '<span style="font-size:0.58em;color:var(--text-dim)">start:</span>'
        + '<button onclick="RecordingAnalyzer._nudgeBoundary(' + i + ',\'start\',-5)" style="' + _tinyBtn + '">-5s</button>'
        + '<button onclick="RecordingAnalyzer._nudgeBoundary(' + i + ',\'start\',5)" style="' + _tinyBtn + '">+5s</button>'
        + '<span style="font-size:0.58em;color:var(--text-dim);margin-left:4px">end:</span>'
        + '<button onclick="RecordingAnalyzer._nudgeBoundary(' + i + ',\'end\',-5)" style="' + _tinyBtn + '">-5s</button>'
        + '<button onclick="RecordingAnalyzer._nudgeBoundary(' + i + ',\'end\',5)" style="' + _tinyBtn + '">+5s</button>'
        + '</div></details>';

      // Chord analysis: button, refresh, or unavailable message
      if (segTypeVal === 'song' && seg.duration >= 30) {
        var _hasCachedHints = seg.chordHints && seg.chordHints.usable;
        var _cacheStale = seg.chordHints && seg._chordCacheKey !== _chordCacheKey(seg);
        var _requestedButUnavailable = seg._chordRequested && seg.chordHints && !seg.chordHints.usable && !_cacheStale;

        if (!_hasCachedHints || _cacheStale) {
          var _btnLabel = _cacheStale ? '\uD83C\uDFB5 Refresh chord hints' : (_requestedButUnavailable ? '\uD83C\uDFB5 Retry' : '\uD83C\uDFB5 Get chord hints');
          html += '<button id="raChordBtn' + i + '" onclick="RecordingAnalyzer._fetchChordHints(' + i + ')" style="font-size:0.55em;padding:2px 6px;border-radius:4px;border:1px solid rgba(129,140,248,0.15);background:rgba(129,140,248,0.04);color:#818cf8;cursor:pointer;font-family:inherit;margin-top:3px">' + _btnLabel + '</button>';
        }

        // Show minimal message when user requested but result was unusable
        if (_requestedButUnavailable) {
          var _retryCount = seg._chordRetryCount || 0;
          var _unavailMsg = _retryCount >= 2
            ? 'Still unclear \u2014 try a longer segment or full run'
            : (seg.chordHints.error || 'Harmonic movement unclear \u2014 review against chart');
          html += '<div style="font-size:0.55em;color:var(--text-dim);margin-top:2px;font-style:italic">' + _escAttr(_unavailMsg) + '</div>';
        }

        // First-use tooltip (shown once)
        if (!seg._chordRequested && !window._raChordTooltipShown) {
          html += '<div style="font-size:0.5em;color:var(--text-dim);margin-top:1px;opacity:0.5">Works best on full song runs (60\u2013180s)</div>';
        }
      }

      // Harmonic hints display (Song segments only, when usable + cache valid)
      if (segTypeVal === 'song' && seg.chordHints && seg.chordHints.usable && seg._chordCacheKey === _chordCacheKey(seg)) {
        var ch = seg.chordHints;
        var chConf = ch.confidence || 'low';
        var chColor = chConf === 'high' ? '#10b981' : chConf === 'medium' ? '#f59e0b' : '#64748b';
        html += '<details style="margin-top:3px;border:1px solid rgba(255,255,255,0.04);border-radius:5px">'
          + '<summary style="padding:3px 6px;font-size:0.58em;color:' + chColor + ';cursor:pointer;list-style:none;user-select:none">'
          + '\uD83C\uDFB5 Harmonic hints (' + chConf + ')</summary>'
          + '<div style="padding:4px 6px;font-size:0.62em;color:var(--text-dim);line-height:1.5">';
        if (ch.summary) {
          if (ch.summary.topProgressionHint) {
            html += '<div>Likely movement: <span style="color:var(--text)">' + _escAttr(ch.summary.topProgressionHint) + '</span></div>';
          }
          if (ch.summary.openingChord && ch.summary.openingChord !== 'N') {
            html += '<div>Starts on <span style="color:var(--text)">' + _escAttr(ch.summary.openingChord) + '</span>';
            if (ch.summary.endingChord && ch.summary.endingChord !== ch.summary.openingChord && ch.summary.endingChord !== 'N') {
              html += ' \u2192 ends on <span style="color:var(--text)">' + _escAttr(ch.summary.endingChord) + '</span>';
            }
            html += '</div>';
          }
          if (ch.summary.changeCount > 0) {
            html += '<div>' + ch.summary.changeCount + ' likely changes</div>';
          }
        }
        // Timeline (high confidence only, capped at 8 rows)
        if (chConf === 'high' && ch.timeline && ch.timeline.length) {
          var _maxRows = 8;
          if (ch.timeline.length > _maxRows + 2) {
            html += '<div style="margin-top:3px;color:var(--text-dim);font-style:italic">Frequent harmonic movement \u2014 review against chart</div>';
          } else {
            html += '<details style="margin-top:3px"><summary style="cursor:pointer;color:var(--text-dim)">Show timeline (' + ch.timeline.length + ')</summary><div style="margin-top:2px">';
            ch.timeline.slice(0, _maxRows).forEach(function(t) {
              html += '<div style="display:flex;gap:6px"><span style="min-width:70px;color:var(--text-dim)">[' + t.startSec.toFixed(1) + '\u2013' + t.endSec.toFixed(1) + ']</span><span style="color:var(--text)">' + _escAttr(t.chord) + '</span></div>';
            });
            if (ch.timeline.length > _maxRows) html += '<div style="color:var(--text-dim)">+' + (ch.timeline.length - _maxRows) + ' more regions</div>';
            html += '</div></details>';
          }
        }
        // Practice suggestion (actionable, 1 line)
        if (ch.summary && ch.summary.practiceSuggestion) {
          html += '<div style="margin-top:4px;padding:3px 6px;border-radius:4px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.1);font-size:0.95em;color:#a5b4fc">\uD83C\uDFAF ' + _escAttr(ch.summary.practiceSuggestion) + '</div>';
        }
        html += '<div style="font-size:0.85em;color:var(--text-dim);margin-top:3px;font-style:italic">' + _escAttr(ch.reviewGuidance ? ch.reviewGuidance.message : 'Review to confirm') + '</div>';
        html += '<div style="font-size:0.8em;color:var(--text-dim);margin-top:1px;opacity:0.5">Based on this segment\u2019s audio</div>';
        html += '</div></details>';
      }

      // Row 4: talking segment — quick tags + notes
      if (segTypeVal === 'talking') {
        var _talkTags = ['tempo','transition','ending','arrangement','vocals'];
        var _curTags = (seg.talkTags || []);
        html += '<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap;margin-bottom:3px">';
        _talkTags.forEach(function(tag) {
          var active = _curTags.indexOf(tag) !== -1;
          html += '<button onclick="RecordingAnalyzer._toggleTalkTag(' + i + ',\'' + tag + '\')" style="font-size:0.6em;padding:1px 6px;border-radius:3px;border:1px solid ' + (active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#818cf8' : 'var(--text-dim)') + ';cursor:pointer;font-family:inherit">' + tag + '</button>';
        });
        html += '</div>';
        // Transcript (from Deepgram) or manual notes
        if (seg.transcript) {
          html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(99,102,241,0.15);border-radius:4px;padding:4px 6px;margin-top:3px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between">'
            + '<span style="font-size:0.58em;color:#818cf8">Transcribed</span>'
            + '<button onclick="RecordingAnalyzer._transcribeSeg(' + i + ')" id="raTransBtn' + i + '" style="font-size:0.55em;padding:1px 5px;border-radius:3px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-family:inherit">Retranscribe</button>'
            + '</div>'
            + '<textarea onchange="RecordingAnalyzer._updateTranscript(' + i + ',this.value)" style="width:100%;min-height:40px;background:none;border:none;color:var(--text-dim);font-size:0.72em;font-family:inherit;resize:vertical">' + _escAttr(seg.transcript) + '</textarea>'
            + '</div>';
        } else {
          html += '<div style="display:flex;gap:4px;align-items:center;margin-top:3px">'
            + '<input type="text" value="' + _escAttr(seg.notes || '') + '" onchange="RecordingAnalyzer._updateSegNotes(' + i + ',this.value)" style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:3px 6px;color:var(--text-dim);font-size:0.72em;font-family:inherit" placeholder="What was discussed...">'
            + '<button id="raTransBtn' + i + '" onclick="RecordingAnalyzer._transcribeSeg(' + i + ')" style="font-size:0.6em;padding:2px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8;cursor:pointer;flex-shrink:0;font-family:inherit;white-space:nowrap">\uD83C\uDFA4 Transcribe</button>'
            + '</div>';
        }
        // Suggested tags from transcript content
        if (seg.transcript && !seg._tagsSuggested) {
          var _suggestMap = { tempo: /tempo|bpm|speed|slow|fast/i, transition: /transition|change|bridge|move/i, ending: /ending|outro|finish|close/i, arrangement: /arrange|part|section|structure/i, vocals: /vocal|sing|harmony|lyric/i };
          var _suggested = [];
          Object.keys(_suggestMap).forEach(function(tag) {
            if (_suggestMap[tag].test(seg.transcript) && (!seg.talkTags || seg.talkTags.indexOf(tag) === -1)) _suggested.push(tag);
          });
          if (_suggested.length) {
            html += '<div style="font-size:0.55em;color:var(--text-dim);margin-top:2px">Suggested tags: '
              + _suggested.map(function(t) { return '<button onclick="RecordingAnalyzer._toggleTalkTag(' + i + ',\'' + t + '\')" style="color:#818cf8;background:none;border:none;cursor:pointer;text-decoration:underline;font-family:inherit;font-size:1em">+' + t + '</button>'; }).join(' ')
              + '</div>';
          }
          seg._tagsSuggested = true;
        }
        if (_curTags.length) html += '<div style="font-size:0.58em;color:#818cf8;margin-top:2px">Tags + transcript will be included in report</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:var(--bg-card,#1e293b);padding:8px 0 0">'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted,#94a3b8);cursor:pointer;font-size:0.82em;font-weight:600">Cancel</button>'
      + '<button onclick="RecordingAnalyzer.confirmAndGenerate()" style="padding:8px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;cursor:pointer;font-size:0.82em;font-weight:700;box-shadow:0 2px 8px rgba(34,197,94,0.2)">' + (_allConfirmed ? 'Review complete \u2713 \u2014 Generate Report' : 'Generate Report') + '</button>'
      + '</div>';

    modal.innerHTML = html;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Auto-focus first segment needing review
    requestAnimationFrame(function() {
      for (var fi = 0; fi < _currentSegments.length; fi++) {
        if (_currentSegments[fi].confidence < 0.4 || _currentSegments[fi].unplanned) {
          var fel = document.getElementById('raSeg' + fi);
          if (fel) {
            fel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fel.style.transition = 'box-shadow 0.3s';
            fel.style.boxShadow = '0 0 12px rgba(248,113,113,0.25)';
            setTimeout(function() { if (fel) fel.style.boxShadow = ''; }, 2500);
          }
          break;
        }
      }
    });
  }

  // ── UI Helpers ──────────────────────────────────────────────────────────────

  function _confirmSeg(idx) {
    if (!_currentSegments || !_currentSegments[idx]) return;
    var seg = _currentSegments[idx];
    seg.confirmed = true;
    var btn = document.getElementById('raConfBtn' + idx);
    if (btn) { btn.style.color = '#10b981'; btn.style.borderColor = 'rgba(16,185,129,0.3)'; }

    // Record confirmation for accuracy tracking + embedding bank
    if (typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.recordConfirmation && seg.songTitle) {
      SongMatchingEngine.recordConfirmation(seg, seg.songTitle);
    }

    // Non-blocking: fetch embedding for confirmed Song segment (for future matching)
    if (seg.segType === 'song' && seg.songTitle && seg.duration >= 30 && !seg.audioEmbedding && _currentAudioUrl) {
      _fetchEmbeddingForSeg(idx).catch(function() {}); // fire-and-forget
    }

    // Auto-advance to next unconfirmed
    for (var ni = idx + 1; ni < _currentSegments.length; ni++) {
      if (!_currentSegments[ni].confirmed) {
        var nel = document.getElementById('raSeg' + ni);
        if (nel) nel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  }

  // Non-blocking embedding fetch for a confirmed segment
  async function _fetchEmbeddingForSeg(idx) {
    var seg = _currentSegments[idx];
    if (!seg || !_currentAudioUrl) return;

    var cacheKey = (seg.id || '') + '|' + seg.startSec.toFixed(1) + '|' + seg.endSec.toFixed(1) + '|emb1';
    if (_embedCacheLocal[cacheKey]) {
      seg.audioEmbedding = _embedCacheLocal[cacheKey];
      if (typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.storeConfirmedEmbedding) {
        var _sid = seg.songMatch && seg.songMatch.bestMatch ? seg.songMatch.bestMatch.songId : null;
          SongMatchingEngine.storeConfirmedEmbedding(_sid || seg.songTitle, seg.songTitle, seg.audioEmbedding, { segType: seg.segType, duration: seg.duration, qualityScore: seg.qualityScore });
      }
      return;
    }

    try {
      var response = await fetch(_currentAudioUrl);
      var fullBuffer = await response.arrayBuffer();
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var decoded = await audioCtx.decodeAudioData(fullBuffer);
      var startSample = Math.floor(seg.startSec * decoded.sampleRate);
      var endSample = Math.min(Math.floor(seg.endSec * decoded.sampleRate), decoded.length);
      var channel = decoded.getChannelData(0);
      var segData = channel.slice(startSample, endSample);
      var wavBuffer = _encodeWAV(segData, decoded.sampleRate);
      audioCtx.close();

      var serviceUrl = window._glEmbedServiceUrl || 'http://localhost:8200';
      var formData = new FormData();
      formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'segment.wav');
      var res = await fetch(serviceUrl + '/embed', { method: 'POST', body: formData });
      var result = await res.json();

      if (result.embedding && result.embedding.length) {
        seg.audioEmbedding = result.embedding;
        _embedCacheLocal[cacheKey] = result.embedding;
        // Store in the matching engine's bank
        if (typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.storeConfirmedEmbedding) {
          var _sid = seg.songMatch && seg.songMatch.bestMatch ? seg.songMatch.bestMatch.songId : null;
          SongMatchingEngine.storeConfirmedEmbedding(_sid || seg.songTitle, seg.songTitle, seg.audioEmbedding, { segType: seg.segType, duration: seg.duration, qualityScore: seg.qualityScore });
        }
        console.log('[RecordingAnalyzer] Embedding stored for ' + seg.songTitle + ' (' + result.dimension + 'd)');
      }
    } catch(e) {
      // Silent failure — embedding is a supporting signal, not critical
      console.warn('[RecordingAnalyzer] Embedding fetch failed for seg ' + idx + ':', e.message);
    }
  }
  var _embedCacheLocal = {};

  function _toggleTalkTag(idx, tag) {
    if (!_currentSegments || !_currentSegments[idx]) return;
    if (!_currentSegments[idx].talkTags) _currentSegments[idx].talkTags = [];
    var tags = _currentSegments[idx].talkTags;
    var pos = tags.indexOf(tag);
    if (pos === -1) tags.push(tag);
    else tags.splice(pos, 1);
    // Re-render to update tag styling
    showUI(_currentSessionId, _currentSegments);
  }

  function _updateTranscript(idx, value) {
    if (_currentSegments && _currentSegments[idx]) {
      _currentSegments[idx].transcript = value;
      _currentSegments[idx].notes = value; // keep in sync for report
      _currentSegments[idx]._userEdited = true; // flag to prevent overwrite
    }
  }

  // ── User label overrides (persist across re-analyses) ──────────────────────
  var _userOverrides = {}; // segmentIndex → confirmedTitle

  function _updateSegTitle(idx, value) {
    if (_currentSegments && _currentSegments[idx]) {
      var seg = _currentSegments[idx];
      // Record correction
      if (value && seg.songTitle && value !== seg.songTitle && typeof SongMatchingEngine !== 'undefined' && SongMatchingEngine.recordConfirmation) {
        SongMatchingEngine.recordConfirmation(seg, value);
      }
      seg.songTitle = value;
      seg.displayTitle = value;
      seg.confidence = value ? 0.9 : 0.1;
      seg.confirmed = true;
      var btn = document.getElementById('raConfBtn' + idx);
      if (btn) { btn.style.color = '#10b981'; btn.style.borderColor = 'rgba(16,185,129,0.3)'; }

      // Save override for future re-analyses (keyed by time range for stability)
      var overrideKey = Math.round(seg.startSec) + '_' + Math.round(seg.endSec);
      _userOverrides[overrideKey] = value;
      // Persist to Firebase
      if (_currentSessionId && typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
        firebaseDB.ref(bandPath('rehearsal_sessions/' + _currentSessionId + '/label_overrides/' + overrideKey)).set(value).catch(function() {});
      }
    }
  }

  /**
   * Apply saved user overrides to segments after matching.
   * Called during analyze() after SongMatchingEngine.run().
   */
  function _applyUserOverrides(segments, sessionId) {
    if (!segments || !segments.length) return;
    // Load overrides from Firebase if not already loaded
    if (Object.keys(_userOverrides).length === 0 && sessionId && typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
      firebaseDB.ref(bandPath('rehearsal_sessions/' + sessionId + '/label_overrides')).once('value').then(function(snap) {
        var overrides = snap.val();
        if (overrides && typeof overrides === 'object') {
          _userOverrides = overrides;
          // Apply to current segments
          segments.forEach(function(seg) {
            var key = Math.round(seg.startSec) + '_' + Math.round(seg.endSec);
            if (_userOverrides[key]) {
              seg.songTitle = _userOverrides[key];
              seg.displayTitle = _userOverrides[key];
              seg.confidence = 0.95;
              seg.confirmed = true;
              console.log('[RecordingAnalyzer] Applied override: ' + key + ' → ' + _userOverrides[key]);
            }
          });
        }
      }).catch(function() {});
    } else {
      // Apply from memory
      segments.forEach(function(seg) {
        var key = Math.round(seg.startSec) + '_' + Math.round(seg.endSec);
        if (_userOverrides[key]) {
          seg.songTitle = _userOverrides[key];
          seg.displayTitle = _userOverrides[key];
          seg.confidence = 0.95;
          seg.confirmed = true;
        }
      });
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
    // Auto-confirm on play
    seg.confirmed = true;
    var confBtn = document.getElementById('raConfBtn' + idx);
    if (confBtn) { confBtn.style.color = '#10b981'; confBtn.style.borderColor = 'rgba(16,185,129,0.3)'; }
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

  function _seekSeg(idx, deltaSec) {
    var audio = document.getElementById('raPlaybackAudio');
    if (!audio || !_currentSegments || !_currentSegments[idx]) return;
    var seg = _currentSegments[idx];
    var newTime = Math.max(seg.startSec, Math.min(audio.currentTime + deltaSec, seg.endSec));
    audio.currentTime = newTime;
    // Auto-play if not already playing this segment
    if (audio.paused || _currentPlayingIdx !== idx) {
      _playSeg(idx);
    }
  }

  function _nudgeBoundary(idx, which, deltaSec) {
    if (!_currentSegments || !_currentSegments[idx]) return;
    var seg = _currentSegments[idx];
    if (which === 'start') {
      seg.startSec = Math.max(0, seg.startSec + deltaSec);
    } else {
      seg.endSec = Math.max(seg.startSec + 1, seg.endSec + deltaSec);
    }
    seg.duration = seg.endSec - seg.startSec;
    // Re-render just the time display (avoid full re-render)
    var el = document.getElementById('raSeg' + idx);
    if (el) {
      var timeDiv = el.querySelector('div > div:nth-child(2)');
      if (timeDiv) {
        var durLabel = seg.duration >= 60 ? Math.round(seg.duration / 60) + 'm' : Math.round(seg.duration) + 's';
        timeDiv.innerHTML = _formatTime(seg.startSec) + '\u2013' + _formatTime(seg.endSec) + '<br>' + durLabel;
      }
    }
  }

  async function _transcribeSeg(idx) {
    if (!_currentSegments || !_currentSegments[idx] || !_currentAudioUrl) return;
    var seg = _currentSegments[idx];
    var btn = document.getElementById('raTransBtn' + idx);
    if (btn) { btn.textContent = 'Transcribing...'; btn.disabled = true; }

    try {
      // Extract segment audio as WAV by fetching the blob and decoding a slice
      var response = await fetch(_currentAudioUrl);
      var fullBuffer = await response.arrayBuffer();
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var decoded = await audioCtx.decodeAudioData(fullBuffer);

      // Extract segment range
      var startSample = Math.floor(seg.startSec * decoded.sampleRate);
      var endSample = Math.min(Math.floor(seg.endSec * decoded.sampleRate), decoded.length);
      var numSamples = endSample - startSample;
      if (numSamples < decoded.sampleRate) { // less than 1 second
        if (btn) { btn.textContent = 'Too short'; btn.disabled = false; }
        return;
      }

      // Build mono WAV
      var channel = decoded.getChannelData(0);
      var segData = channel.slice(startSample, endSample);
      var wavBuffer = _encodeWAV(segData, decoded.sampleRate);
      audioCtx.close();

      // Send to Worker
      var workerUrl = (typeof WORKER_URL !== 'undefined') ? WORKER_URL : 'https://groovelinx-worker.drewmerrill.workers.dev';
      var res = await fetch(workerUrl + '/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBuffer
      });

      var result = await res.json();
      if (result.error) {
        if (typeof showToast === 'function') showToast('Transcription: ' + result.error);
        if (btn) { btn.textContent = '\uD83C\uDFA4 Transcribe'; btn.disabled = false; }
        return;
      }

      // Save transcript to segment (respect user edits unless retranscribing)
      seg.transcript = result.transcript || '';
      if (!seg._userEdited) seg.notes = seg.transcript;
      seg.speakers = result.speakers || [];
      seg.confirmed = true;
      seg._tagsSuggested = false; // re-suggest tags from new transcript
      seg._userEdited = false; // reset edit flag after explicit retranscribe

      if (typeof showToast === 'function') showToast('Transcribed: ' + (seg.transcript.length > 50 ? seg.transcript.slice(0, 50) + '...' : seg.transcript));

      // Re-render to show transcript
      showUI(_currentSessionId, _currentSegments);

    } catch(e) {
      console.error('[RecordingAnalyzer] Transcription failed:', e);
      if (btn) { btn.textContent = '\uD83C\uDFA4 Retry'; btn.disabled = false; }
      if (typeof showToast === 'function') showToast('Transcription failed: ' + e.message);
    }
  }

  // Encode Float32Array to WAV ArrayBuffer
  function _encodeWAV(samples, sampleRate) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);
    function writeStr(offset, str) { for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (var i = 0; i < samples.length; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  // ── Chord hints (on-demand per segment) ──────────────────────────────────────

  var _chordCache = {}; // keyed by composite key
  // Bump this when: smoothing thresholds change, confidence rules change,
  // progression logic changes, or chord service API changes.
  var _CHORD_ANALYSIS_VERSION = 1;

  function _chordCacheKey(seg) {
    return seg.id + '|' + seg.startSec.toFixed(1) + '|' + seg.endSec.toFixed(1) + '|v' + _CHORD_ANALYSIS_VERSION;
  }

  // Queue chord analysis to prevent concurrent full-file decodes (causes OOM)
  var _chordQueue = [];
  var _chordProcessing = false;

  async function _fetchChordHints(idx) {
    // Add to queue if already processing
    if (_chordProcessing) {
      _chordQueue.push(idx);
      if (typeof showToast === 'function') showToast('Queued \u2014 analyzing one at a time to prevent crashes');
      return;
    }
    _chordProcessing = true;
    try {
      await _fetchChordHintsInner(idx);
    } finally {
      _chordProcessing = false;
      // Process next in queue
      if (_chordQueue.length > 0) {
        var next = _chordQueue.shift();
        _fetchChordHints(next);
      }
    }
  }

  async function _fetchChordHintsInner(idx) {
    if (!_currentSegments || !_currentSegments[idx] || !_currentAudioUrl) return;
    var seg = _currentSegments[idx];

    // Skip ineligible
    if (seg.segType && seg.segType !== 'song') {
      if (typeof showToast === 'function') showToast('Chord hints only available for Song segments');
      return;
    }
    if (seg.duration < 30) {
      if (typeof showToast === 'function') showToast('Segment too short for chord analysis');
      return;
    }

    // Check cache (invalidates when boundaries change)
    var cacheKey = _chordCacheKey(seg);
    if (_chordCache[cacheKey] && seg.chordHints && seg._chordCacheKey === cacheKey) return;

    // Track retry count for escalating messages
    seg._chordRetryCount = (seg._chordRetryCount || 0) + 1;
    // Mark first-use tooltip as shown
    window._raChordTooltipShown = true;

    var btn = document.getElementById('raChordBtn' + idx);
    if (btn) { btn.textContent = 'Analyzing...'; btn.disabled = true; }

    try {
      // Extract segment audio as WAV
      var response = await fetch(_currentAudioUrl);
      var fullBuffer = await response.arrayBuffer();
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var decoded = await audioCtx.decodeAudioData(fullBuffer);

      var startSample = Math.floor(seg.startSec * decoded.sampleRate);
      var endSample = Math.min(Math.floor(seg.endSec * decoded.sampleRate), decoded.length);
      var channel = decoded.getChannelData(0);
      var segData = channel.slice(startSample, endSample);
      var wavBuffer = _encodeWAV(segData, decoded.sampleRate);
      audioCtx.close();

      // Build form data
      var formData = new FormData();
      formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'segment.wav');
      formData.append('segment_id', seg.id);
      formData.append('song_name', seg.songTitle || '');
      formData.append('segment_type', seg.segType || 'song');
      formData.append('duration_sec', String(seg.duration));

      // Call chord service
      var serviceUrl = window._glChordServiceUrl || 'http://localhost:8100';
      var res = await fetch(serviceUrl + '/analyze-chords', { method: 'POST', body: formData });
      var result = await res.json();

      // Always attach result (even if unusable) + mark that user requested it
      seg.chordHints = result;
      seg._chordRequested = true; // user explicitly asked for hints
      seg._chordCacheKey = cacheKey;
      _chordCache[cacheKey] = result;

      if (result.error) {
        if (typeof showToast === 'function') showToast('Chord analysis: ' + result.error);
      } else if (!result.usable) {
        if (typeof showToast === 'function') showToast('Harmonic movement unclear for this segment');
      } else {
        var hint = result.summary && result.summary.topProgressionHint ? result.summary.topProgressionHint : 'Analysis complete';
        if (typeof showToast === 'function') showToast('Chord hints: ' + hint);
      }

      // Re-render to show hints or unavailable message
      showUI(_currentSessionId, _currentSegments);

    } catch(e) {
      console.error('[RecordingAnalyzer] Chord analysis failed:', e);
      if (btn) { btn.textContent = '\uD83C\uDFB5 Retry'; btn.disabled = false; }
      if (typeof showToast === 'function') showToast('Chord analysis failed: ' + e.message);
    }
  }

  function _jumpToSong(title) {
    if (!_currentSegments) return;
    var lower = title.toLowerCase();
    for (var i = 0; i < _currentSegments.length; i++) {
      if (_currentSegments[i].songTitle && _currentSegments[i].songTitle.toLowerCase() === lower) {
        var el = document.getElementById('raSeg' + i);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'box-shadow 0.3s';
          el.style.boxShadow = '0 0 12px rgba(99,102,241,0.3)';
          setTimeout(function() { el.style.boxShadow = ''; }, 2000);
        }
        return;
      }
    }
  }

  function _addToNextPlan(title) {
    // Add song to rehearsal planner queue
    try {
      if (typeof window.glPlannerQueue !== 'undefined') {
        var exists = window.glPlannerQueue.some(function(item) {
          var t = typeof item === 'string' ? item : (item.title || '');
          return t.toLowerCase() === title.toLowerCase();
        });
        if (!exists) {
          window.glPlannerQueue.push({ title: title });
          if (typeof showToast === 'function') showToast(title + ' added to next rehearsal plan');
        } else {
          if (typeof showToast === 'function') showToast(title + ' already in plan');
        }
      } else {
        window.glPlannerQueue = [{ title: title }];
        if (typeof showToast === 'function') showToast(title + ' added to next rehearsal plan');
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('Could not add to plan');
    }
  }

  function _buildBehaviorInsights(songTime, totalTime) {
    var insights = [];
    if (!totalTime || totalTime < 60) return insights;

    // Time distribution
    var sorted = Object.keys(songTime).map(function(k) { return { title: k, time: songTime[k] }; });
    sorted.sort(function(a, b) { return b.time - a.time; });
    if (sorted.length >= 3) {
      var topTwo = sorted.slice(0, 2);
      var topPct = Math.round((topTwo[0].time + topTwo[1].time) / totalTime * 100);
      if (topPct >= 35) {
        insights.push('You spent ' + topPct + '% of rehearsal on ' + topTwo[0].title + ' and ' + topTwo[1].title);
      }
    }
    if (sorted.length > 0 && sorted[0].time / totalTime >= 0.25) {
      insights.push(sorted[0].title + ' dominated rehearsal time (' + Math.round(sorted[0].time / 60) + ' min)');
    }

    // Skipped songs
    if (_planVsActual && _planVsActual.missing.length > 0) {
      insights.push('You skipped ' + _planVsActual.missing.length + ' planned song' + (_planVsActual.missing.length > 1 ? 's' : ''));
    }

    // Restarts
    if (_planVsActual && _planVsActual.repeated.length) {
      var mostRepeated = _planVsActual.repeated.sort(function(a, b) { return b.attempts - a.attempts; })[0];
      if (mostRepeated.attempts >= 3) {
        insights.push(mostRepeated.title + ' took ' + mostRepeated.attempts + ' attempts \u2014 might need focused practice');
      }
    }

    // Groove insights (from per-segment groove data)
    if (_currentSegments) {
      var rushingSegs = _currentSegments.filter(function(s) { return s.groove && s.groove.drift === 'Rushing'; });
      var draggingSegs = _currentSegments.filter(function(s) { return s.groove && s.groove.drift === 'Dragging'; });
      var lockedSegs = _currentSegments.filter(function(s) { return s.groove && s.groove.stability >= 80; });

      if (rushingSegs.length >= 3) {
        insights.push('Rushing in ' + rushingSegs.length + ' sections \u2014 try with a click track');
      } else if (draggingSegs.length >= 3) {
        insights.push('Dragging in ' + draggingSegs.length + ' sections \u2014 push the energy');
      }
      if (lockedSegs.length > 0 && _currentSegments.length > 0) {
        var lockedPct = Math.round(lockedSegs.length / _currentSegments.filter(function(s) { return s.groove; }).length * 100);
        if (lockedPct >= 60) insights.push('Locked in on ' + lockedPct + '% of songs \u2014 the groove is there');
      }

      // Best attempt + improvement detection
      var songAttempts = {};
      _currentSegments.forEach(function(s) {
        if (s.songTitle && s.qualityScore) {
          if (!songAttempts[s.songTitle]) songAttempts[s.songTitle] = [];
          songAttempts[s.songTitle].push(s);
        }
      });
      Object.keys(songAttempts).forEach(function(title) {
        var attempts = songAttempts[title];
        if (attempts.length < 2) return;

        // Score each attempt
        var scores = attempts.map(function(a) {
          return a.qualityScore + (a.groove ? a.groove.stability / 25 : 0);
        });

        // Find best
        var bestIdx = 0;
        for (var ai = 1; ai < scores.length; ai++) {
          if (scores[ai] > scores[bestIdx]) bestIdx = ai;
        }
        attempts[bestIdx].qualityLabel = 'Best attempt';
        attempts[bestIdx].qualityWhy = 'Highest combined quality + groove stability';

        // Detect improvement/decline trend
        if (scores.length >= 2) {
          var last = scores[scores.length - 1];
          var first = scores[0];
          if (last > first + 0.5) {
            attempts[attempts.length - 1].improvementNote = 'Improved on later attempt';
            insights.push(title + ': improved on second pass');
          } else if (first > last + 0.5) {
            attempts[attempts.length - 1].improvementNote = 'Dropped off after first run';
          }
        }
      });
    }

    return insights.slice(0, 3);
  }

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
          var talkContent = seg.transcript || seg.notes || '';
          var talkTags = (seg.talkTags && seg.talkTags.length) ? ' [' + seg.talkTags.join(', ') + ']' : '';
          return timeLabel + ' [Discussion]' + talkTags + (talkContent ? ' ' + talkContent : '');
        }
        if (type === 'restart') {
          return timeLabel + ' [Restart] ' + (seg.songTitle || '');
        }
        if (type === 'jam') {
          return timeLabel + ' [Jam] ' + (seg.songTitle || 'Improv');
        }
        var songLabel = seg.songTitle || 'Unknown';
        var durMin = Math.round(seg.duration / 60);
        var line = timeLabel + ' ' + songLabel + ' (' + durMin + ' min)';
        // Append chord hint only when confidence is medium+ and adds value
        if (seg.chordHints && seg.chordHints.usable && seg.chordHints.confidence !== 'low' && seg.chordHints.summary) {
          var ch = seg.chordHints.summary;
          // Only include if progression hint exists (skip trivial "1 change" cases)
          if (ch.topProgressionHint && ch.changeCount >= 3) {
            line += ' [Likely: ' + ch.topProgressionHint + ']';
          }
        }
        return line;
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

  // ── Step 1: Recording Type ──────────────────────────────────────────────────

  function _showContextPicker(sessionId) {
    var existing = document.getElementById('raOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'raOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)';

    var _btn = 'padding:12px 16px;border-radius:10px;color:var(--text,#f1f5f9);cursor:pointer;text-align:left;font-family:inherit;width:100%';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6)';
    modal.innerHTML = '<div style="font-size:0.65em;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Step 1 of 2</div>'
      + '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:4px">What is this recording?</div>'
      + '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-bottom:16px">This helps match songs accurately</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px">'
      + '<button onclick="RecordingAnalyzer._selectContext(\'rehearsal\',\'' + _escAttr(sessionId) + '\')" style="' + _btn + ';border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06)"><div style="font-weight:700;font-size:0.88em">\uD83E\uDD41 Band Rehearsal</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Match against rehearsal plan</div></button>'
      + '<button onclick="RecordingAnalyzer._selectContext(\'gig\',\'' + _escAttr(sessionId) + '\')" style="' + _btn + ';border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.04)"><div style="font-weight:700;font-size:0.88em">\uD83C\uDFA4 Live Gig</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Match against setlist</div></button>'
      + '<button onclick="RecordingAnalyzer._selectContext(\'practice\',\'' + _escAttr(sessionId) + '\')" style="' + _btn + ';border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02)"><div style="font-weight:700;font-size:0.88em">\uD83C\uDFB8 Individual Practice</div><div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Single song focus</div></button>'
      + '</div>'
      + '<button onclick="document.getElementById(\'raOverlay\').remove()" style="margin-top:12px;width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em">Cancel</button>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ── Step 2: Rehearsal Plan Selection + Song Confirmation ────────────────────

  function _selectContext(type, sessionId) {
    if (type === 'rehearsal') {
      _showRehearsalPlanPicker(sessionId);
    } else if (type === 'gig') {
      var songs = _getSetlistSongs();
      _recordingContext = { type: 'gig', referenceSongs: songs, referenceId: sessionId };
      _showSongConfirmation(sessionId, songs);
    } else if (type === 'practice') {
      _showPracticeSongPicker(sessionId);
    }
  }

  function _showRehearsalPlanPicker(sessionId) {
    var overlay = document.getElementById('raOverlay');
    if (!overlay) return;
    var modal = overlay.querySelector('div');
    if (!modal) return;

    // Load past sessions for plan options
    var sessions = [];
    try {
      if (typeof _rhLoadSessions === 'function') {
        // Can't await from here — use cached data
        // Sessions are typically cached from page render
      }
      // Use Firebase direct read for session list
      if (typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
        firebaseDB.ref(bandPath('rehearsal_sessions')).orderByChild('date').limitToLast(10).once('value').then(function(snap) {
          var data = snap.val();
          if (data) {
            sessions = Object.keys(data).map(function(k) {
              var s = data[k]; s.sessionId = k; return s;
            }).filter(function(s) { return s.date && s.songsWorked && s.songsWorked.length; })
            .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
          }
          _renderPlanPicker(modal, sessionId, sessions);
        }).catch(function() { _renderPlanPicker(modal, sessionId, []); });
        return;
      }
    } catch(e) {}
    _renderPlanPicker(modal, sessionId, []);
  }

  function _renderPlanPicker(modal, sessionId, sessions) {
    // Get current planner queue
    var planSongs = [];
    try {
      var q = (typeof window.glPlannerQueue !== 'undefined') ? window.glPlannerQueue : [];
      planSongs = q.map(function(item) { return typeof item === 'string' ? item : (item.title || ''); }).filter(Boolean);
    } catch(e) {}

    var html = '<div style="font-size:0.65em;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Step 2 of 2</div>'
      + '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:4px">Which rehearsal?</div>'
      + '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-bottom:12px">Select a plan to match songs against</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">';

    // Current plan (if exists)
    if (planSongs.length) {
      html += '<button onclick="RecordingAnalyzer._confirmPlanSongs(\'' + _escAttr(sessionId) + '\',\'current\')" style="padding:10px 14px;border-radius:8px;border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.06);color:var(--text);cursor:pointer;text-align:left;font-family:inherit;width:100%">'
        + '<div style="font-weight:700;font-size:0.82em">Current Plan (' + planSongs.length + ' songs)</div>'
        + '<div style="font-size:0.68em;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + planSongs.slice(0, 5).join(', ') + (planSongs.length > 5 ? '...' : '') + '</div>'
        + '</button>';
    }

    // Past sessions
    sessions.slice(0, 5).forEach(function(s) {
      var dateLabel = s.date ? new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unknown date';
      var songList = (s.songsWorked || []).slice(0, 4).join(', ');
      html += '<button onclick="RecordingAnalyzer._confirmPlanSongs(\'' + _escAttr(sessionId) + '\',\'' + _escAttr(s.sessionId) + '\')" style="padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:var(--text);cursor:pointer;text-align:left;font-family:inherit;width:100%">'
        + '<div style="font-weight:600;font-size:0.82em">' + dateLabel + ' \u00B7 ' + (s.songsWorked || []).length + ' songs</div>'
        + '<div style="font-size:0.68em;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + songList + '</div>'
        + '</button>';
    });

    // No plan option
    html += '<button onclick="RecordingAnalyzer._confirmPlanSongs(\'' + _escAttr(sessionId) + '\',\'none\')" style="padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:none;color:var(--text-dim);cursor:pointer;text-align:left;font-family:inherit;width:100%;font-size:0.78em">'
      + 'No rehearsal plan \u2014 match against full catalog'
      + '</button>';

    html += '</div>';
    html += '<button onclick="RecordingAnalyzer._showContextPicker(\'' + _escAttr(sessionId) + '\')" style="margin-top:10px;width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.72em">\u2190 Back</button>';

    modal.innerHTML = html;
  }

  function _confirmPlanSongs(sessionId, sourceId) {
    var songs = [];
    if (sourceId === 'current') {
      try {
        var q = (typeof window.glPlannerQueue !== 'undefined') ? window.glPlannerQueue : [];
        songs = q.map(function(item) { return typeof item === 'string' ? item : (item.title || ''); }).filter(Boolean);
      } catch(e) {}
    } else if (sourceId === 'none') {
      songs = [];
      _recordingContext = { type: 'rehearsal', referenceSongs: [], referenceId: sessionId, noPlan: true };
      if (typeof showToast === 'function') showToast('No plan selected \u2014 matching against full catalog', 3000);
      var overlay = document.getElementById('raOverlay');
      if (overlay) overlay.remove();
      _launchFilePicker(sessionId);
      return;
    } else {
      // Load songs from a specific session
      try {
        if (typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
          firebaseDB.ref(bandPath('rehearsal_sessions/' + sourceId + '/songsWorked')).once('value').then(function(snap) {
            songs = snap.val() || [];
            _recordingContext = { type: 'rehearsal', referenceSongs: songs, referenceId: sessionId, sourceSessionId: sourceId };
            _showSongConfirmation(sessionId, songs);
          });
          return;
        }
      } catch(e) {}
    }

    _recordingContext = { type: 'rehearsal', referenceSongs: songs, referenceId: sessionId, sourceSessionId: sourceId };
    if (songs.length) {
      _showSongConfirmation(sessionId, songs);
    } else {
      // No songs to confirm — go straight to file picker
      var overlay = document.getElementById('raOverlay');
      if (overlay) overlay.remove();
      _launchFilePicker(sessionId);
    }
  }

  function _showPracticeSongPicker(sessionId) {
    var overlay = document.getElementById('raOverlay');
    if (!overlay) return;
    var modal = overlay.querySelector('div');
    if (!modal) return;

    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var html = '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:8px">Which song?</div>'
      + '<input id="raPracticeSongInput" type="text" placeholder="Type song name..." style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em;font-family:inherit;margin-bottom:8px" oninput="RecordingAnalyzer._filterPracticeSongs(this.value)">'
      + '<div id="raPracticeSongList" style="max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">';
    songs.slice(0, 30).forEach(function(s) {
      html += '<button onclick="RecordingAnalyzer._selectPracticeSong(\'' + _escAttr(sessionId) + '\',\'' + _escAttr(s.title) + '\')" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.04);background:none;color:var(--text-muted);cursor:pointer;text-align:left;font-family:inherit;font-size:0.78em" data-song="' + _escAttr(s.title.toLowerCase()) + '">' + _escAttr(s.title) + '</button>';
    });
    html += '</div>'
      + '<button onclick="RecordingAnalyzer._showContextPicker(\'' + _escAttr(sessionId) + '\')" style="margin-top:10px;width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.72em">\u2190 Back</button>';

    modal.innerHTML = html;
    modal.querySelector('#raPracticeSongInput').focus();
  }

  function _filterPracticeSongs(query) {
    var lower = query.toLowerCase();
    var list = document.getElementById('raPracticeSongList');
    if (!list) return;
    list.querySelectorAll('button').forEach(function(btn) {
      btn.style.display = (!lower || btn.dataset.song.indexOf(lower) !== -1) ? 'block' : 'none';
    });
  }

  function _selectPracticeSong(sessionId, title) {
    _recordingContext = { type: 'practice', referenceSongs: [title], referenceId: sessionId };
    var overlay = document.getElementById('raOverlay');
    if (overlay) overlay.remove();
    _launchFilePicker(sessionId);
  }

  // ── Song Confirmation (optional step) ──────────────────────────────────────

  function _showSongConfirmation(sessionId, songs) {
    var overlay = document.getElementById('raOverlay');
    if (!overlay) return;
    var modal = overlay.querySelector('div');
    if (!modal) return;

    window._raExpectedSongs = songs.slice();
    var safeSid = _escAttr(sessionId);

    var html = '<div style="font-size:0.65em;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Optional \u2014 helps improve matching</div>'
      + '<div style="font-size:1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:12px">Expected songs</div>'
      + '<div id="raExpectedList" style="display:flex;flex-direction:column;gap:3px;max-height:220px;overflow-y:auto;margin-bottom:8px">';

    songs.forEach(function(s, i) {
      html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:5px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:0.78em">'
        + '<span style="color:var(--text-dim);min-width:14px">' + (i + 1) + '</span>'
        + '<span style="flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escAttr(s) + '</span>'
        + (i > 0 ? '<button onclick="var a=window._raExpectedSongs;var t=a.splice(' + i + ',1)[0];a.splice(' + (i - 1) + ',0,t);RecordingAnalyzer._showSongConfirmation(\'' + safeSid + '\',a)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.65em;padding:0 2px" title="Move up">\u25B2</button>' : '')
        + (i < songs.length - 1 ? '<button onclick="var a=window._raExpectedSongs;var t=a.splice(' + i + ',1)[0];a.splice(' + (i + 1) + ',0,t);RecordingAnalyzer._showSongConfirmation(\'' + safeSid + '\',a)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.65em;padding:0 2px" title="Move down">\u25BC</button>' : '')
        + '<button onclick="window._raExpectedSongs.splice(' + i + ',1);RecordingAnalyzer._showSongConfirmation(\'' + safeSid + '\',window._raExpectedSongs)" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.68em;padding:0 2px">\u2715</button>'
        + '</div>';
    });

    html += '</div>';
    // Add song search
    html += '<div style="margin-bottom:10px">'
      + '<div style="display:flex;gap:4px;align-items:center">'
      + '<input id="raAddSongInput" type="text" placeholder="+ Add song..." oninput="RecordingAnalyzer._filterAddSong(this.value,\'' + safeSid + '\')" style="flex:1;padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text);font-size:0.78em;font-family:inherit">'
      + '<label style="font-size:0.65em;color:var(--text-dim);white-space:nowrap">at #<input id="raInsertPos" type="number" min="0" max="' + songs.length + '" value="0" style="width:48px;padding:2px 4px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text);font-size:1em;font-family:inherit;text-align:center;-moz-appearance:textfield" class="ra-pos-input"></label>'
      + '</div>'
      + '<div id="raAddSongResults" style="max-height:100px;overflow-y:auto"></div>'
      + '</div>';
    html += '<div style="display:flex;gap:6px">'
      + '<button onclick="RecordingAnalyzer._finalizeSongs(\'' + safeSid + '\')" style="flex:1;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;cursor:pointer;font-size:0.85em;font-weight:700">Analyze with these songs</button>'
      + '<button onclick="RecordingAnalyzer._skipConfirmation(\'' + safeSid + '\')" style="padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted);cursor:pointer;font-size:0.82em">Skip</button>'
      + '</div>';

    modal.innerHTML = html;
  }

  function _filterAddSong(query, sessionId) {
    var results = document.getElementById('raAddSongResults');
    if (!results) return;
    if (!query || query.length < 2) { results.innerHTML = ''; return; }
    var lower = query.toLowerCase();
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var existing = (window._raExpectedSongs || []).map(function(s) { return s.toLowerCase(); });
    var matches = songs.filter(function(s) { return s.title.toLowerCase().indexOf(lower) !== -1 && existing.indexOf(s.title.toLowerCase()) === -1; }).slice(0, 5);
    var insertPos = parseInt(document.getElementById('raInsertPos')?.value || '0', 10);
    results.innerHTML = matches.map(function(s) {
      var safeTitle = _escAttr(s.title);
      var safeSid = _escAttr(sessionId);
      return '<button onclick="var pos=parseInt(document.getElementById(\'raInsertPos\')?.value||\'0\',10);window._raExpectedSongs.splice(pos,0,\'' + safeTitle + '\');document.getElementById(\'raAddSongInput\').value=\'\';document.getElementById(\'raAddSongResults\').innerHTML=\'\';RecordingAnalyzer._showSongConfirmation(\'' + safeSid + '\',window._raExpectedSongs)" style="display:block;width:100%;text-align:left;padding:4px 8px;border:none;background:rgba(255,255,255,0.03);color:var(--text-muted);cursor:pointer;font-size:0.75em;font-family:inherit;border-radius:4px;margin-top:2px">+ ' + _escAttr(s.title) + '</button>';
    }).join('');
  }

  function _finalizeSongs(sessionId) {
    if (window._raExpectedSongs) {
      _recordingContext.referenceSongs = window._raExpectedSongs;
    }
    console.log('[RecordingAnalyzer] Confirmed ' + (_recordingContext.referenceSongs || []).length + ' expected songs');
    var overlay = document.getElementById('raOverlay');
    if (overlay) overlay.remove();
    _launchFilePicker(sessionId);
  }

  function _skipConfirmation(sessionId) {
    console.log('[RecordingAnalyzer] Skipped song confirmation');
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

  // ── RMS-based BPM estimation for large files ──────────────────────────────────
  // Uses autocorrelation on the RMS energy timeline to find dominant beat period.
  // Works with the 10Hz energy timeline (100ms windows). Accuracy is limited
  // (~±10 BPM) but sufficient for tempo proximity matching.
  function _estimateBpmFromRMS(rmsSlice, rmsRate) {
    var len = rmsSlice.length;
    if (len < rmsRate * 5) return 0; // need at least 5s

    // Normalize energy to 0-1 range
    var maxE = 0;
    for (var i = 0; i < len; i++) { if (rmsSlice[i] > maxE) maxE = rmsSlice[i]; }
    if (maxE < 0.001) return 0;

    // Onset detection: find energy peaks (positive derivative above threshold)
    var threshold = maxE * 0.3;
    var onsets = [];
    var prevE = 0;
    for (var j = 1; j < len; j++) {
      var e = rmsSlice[j];
      var rising = e > prevE * 1.3 && e > threshold;
      if (rising) {
        var lastOnset = onsets.length > 0 ? onsets[onsets.length - 1] : -10;
        if (j - lastOnset >= 2) { // minimum 200ms gap (300 BPM cap)
          onsets.push(j);
        }
      }
      prevE = e;
    }
    if (onsets.length < 4) return 0; // need at least 4 onsets

    // Compute inter-onset intervals and find median
    var iois = [];
    for (var k = 1; k < onsets.length; k++) {
      var ioi = (onsets[k] - onsets[k - 1]) / rmsRate; // seconds
      if (ioi >= 0.25 && ioi <= 2.0) { // 30-240 BPM range
        iois.push(ioi);
      }
    }
    if (iois.length < 3) return 0;

    iois.sort(function(a, b) { return a - b; });
    var median = iois[Math.floor(iois.length / 2)];
    var bpm = Math.round(60 / median);

    // Sanity check
    if (bpm < 40 || bpm > 240) return 0;
    return bpm;
  }

  // ── Simple RMS-based segmenter for large files ───────────────────────────────
  // Works on the 10Hz energy timeline (one RMS value per 100ms window).
  // Detects music vs silence by comparing energy to a rolling baseline.

  function _segmentFromRMS(rmsData, totalDuration) {
    var RMS_WINDOW_SEC = 0.1; // each sample = 100ms
    var SILENCE_THRESHOLD = 0.25; // fraction of median energy below which = silence (was 0.3)
    var MIN_SILENCE_WINDOWS = 30; // 3 seconds — catch shorter between-song pauses (was 80/8s)
    var MIN_MUSIC_WINDOWS = 200; // 20 seconds minimum for a segment (was 600/60s)
    var MERGE_GAP_WINDOWS = 50; // 5 seconds — merge segments closer than this (was 150/15s)

    // Compute median energy (ignoring zeros)
    var nonZero = [];
    for (var i = 0; i < rmsData.length; i++) {
      if (rmsData[i] > 0.0001) nonZero.push(rmsData[i]);
    }
    nonZero.sort(function(a, b) { return a - b; });
    var median = nonZero.length > 0 ? nonZero[Math.floor(nonZero.length / 2)] : 0.01;
    var threshold = median * SILENCE_THRESHOLD;

    // Pass 1: Find all music regions (even short ones)
    var rawSegments = [];
    var inMusic = false;
    var segStart = 0;
    var silenceCount = 0;

    for (var wi = 0; wi < rmsData.length; wi++) {
      var isSilent = rmsData[wi] < threshold;

      if (inMusic) {
        if (isSilent) {
          silenceCount++;
          if (silenceCount >= MIN_SILENCE_WINDOWS) {
            var endWindow = wi - silenceCount;
            rawSegments.push({ start: segStart, end: endWindow });
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
    if (inMusic) rawSegments.push({ start: segStart, end: rmsData.length });

    // Pass 2: Merge segments separated by gaps < MERGE_GAP_WINDOWS
    // This prevents mid-song quiet sections from splitting a single song
    var merged = [];
    if (rawSegments.length) {
      merged.push(rawSegments[0]);
      for (var mi = 1; mi < rawSegments.length; mi++) {
        var gap = rawSegments[mi].start - merged[merged.length - 1].end;
        if (gap < MERGE_GAP_WINDOWS) {
          // Merge: extend previous segment to include this one
          merged[merged.length - 1].end = rawSegments[mi].end;
        } else {
          merged.push(rawSegments[mi]);
        }
      }
    }

    // Pass 3: Filter to minimum duration
    var segments = [];
    merged.forEach(function(seg) {
      var segDuration = seg.end - seg.start;
      if (segDuration >= MIN_MUSIC_WINDOWS) {
        var segSec = segDuration * RMS_WINDOW_SEC;
        var segType = 'song_full';
        if (segSec < 45) segType = 'false_start';
        else if (segSec < 120) segType = 'song_partial';
        segments.push({
          start_time: seg.start * RMS_WINDOW_SEC,
          end_time: seg.end * RMS_WINDOW_SEC,
          type: segType,
          durationSec: segSec,
          _originalKind: 'music'
        });
      }
    });

    // Pass 4: Detect talking segments in gaps between music
    // Between-song gaps that have energy above silence but below music threshold
    // are likely band members talking (announcing next song, discussing, etc.)
    var talkSegments = [];
    var MIN_TALK_WINDOWS = 30;  // 3 seconds minimum
    var MAX_TALK_WINDOWS = 600; // 60 seconds maximum
    var TALK_ENERGY_MIN = threshold * 0.5; // must have SOME energy (not dead silence)

    // Collect all gaps between music segments
    var allBoundaries = [{ end: 0 }]; // start of recording
    segments.forEach(function(s) {
      allBoundaries.push({ start: s.start_time / RMS_WINDOW_SEC, end: s.end_time / RMS_WINDOW_SEC });
    });
    allBoundaries.push({ start: rmsData.length }); // end of recording

    for (var gi = 0; gi < allBoundaries.length - 1; gi++) {
      var gapStart = Math.floor(allBoundaries[gi].end || 0);
      var gapEnd = Math.floor(allBoundaries[gi + 1].start || rmsData.length);
      var gapLen = gapEnd - gapStart;

      if (gapLen < MIN_TALK_WINDOWS || gapLen > MAX_TALK_WINDOWS) continue;

      // Check if gap has speech-like energy: above dead silence but below music
      var gapEnergy = 0;
      var gapNonSilent = 0;
      for (var gw = gapStart; gw < gapEnd && gw < rmsData.length; gw++) {
        gapEnergy += rmsData[gw];
        if (rmsData[gw] > TALK_ENERGY_MIN) gapNonSilent++;
      }
      var gapAvgEnergy = gapEnergy / Math.max(1, gapLen);
      var gapActivityRatio = gapNonSilent / Math.max(1, gapLen);

      // Speech: has some energy (not silence) but not loud (not music)
      // Activity ratio > 30% means something is happening in this gap
      if (gapAvgEnergy > TALK_ENERGY_MIN && gapAvgEnergy < threshold * 3 && gapActivityRatio > 0.3) {
        talkSegments.push({
          start_time: gapStart * RMS_WINDOW_SEC,
          end_time: gapEnd * RMS_WINDOW_SEC,
          type: 'speech',
          kind: 'speech',
          intent: 'discussion',
          durationSec: (gapEnd - gapStart) * RMS_WINDOW_SEC,
          _originalKind: 'speech'
        });
      }
    }

    // Combine music + talk segments, sorted by time
    var allSegments = segments.concat(talkSegments);
    allSegments.sort(function(a, b) { return (a.start_time || 0) - (b.start_time || 0); });

    console.log('[RecordingAnalyzer] RMS segmentation: ' + segments.length + ' music + ' + talkSegments.length + ' talk segments from ' + rmsData.length + ' windows');

    return {
      events: allSegments,
      summary: {
        totalEvents: allSegments.length,
        songFull: segments.filter(function(s) { return s.type === 'song_full'; }).length,
        songPartial: segments.filter(function(s) { return s.type === 'song_partial'; }).length,
        talkSegments: talkSegments.length
      }
    };
  }

  // ── Split oversized segments using internal energy analysis ──────────────────

  function _splitOversizedSegment(seg, rmsData, sampleRate) {
    // rmsData is either real PCM (high sampleRate) or 10Hz RMS timeline (sampleRate=10)
    var isRmsTimeline = sampleRate <= 100;
    var windowSec = isRmsTimeline ? (1 / sampleRate) : 0.5; // analysis window
    var samplesPerWindow = isRmsTimeline ? 1 : Math.floor(sampleRate * windowSec);

    // Extract energy within segment bounds
    var startIdx = isRmsTimeline ? Math.floor(seg.startSec * sampleRate) : Math.floor(seg.startSec * sampleRate);
    var endIdx = isRmsTimeline ? Math.floor(seg.endSec * sampleRate) : Math.floor(seg.endSec * sampleRate);
    startIdx = Math.max(0, startIdx);
    endIdx = Math.min(rmsData.length, endIdx);

    if (endIdx - startIdx < 10) return [seg]; // too little data

    // Compute energy per analysis window
    var energyWindows = [];
    if (isRmsTimeline) {
      // Already RMS values — just slice
      for (var i = startIdx; i < endIdx; i++) {
        energyWindows.push({ time: i / sampleRate, energy: rmsData[i] });
      }
    } else {
      // Compute RMS from PCM
      for (var wi = startIdx; wi + samplesPerWindow <= endIdx; wi += samplesPerWindow) {
        var sum = 0;
        for (var si = 0; si < samplesPerWindow; si++) {
          var s = rmsData[wi + si];
          sum += s * s;
        }
        energyWindows.push({ time: wi / sampleRate, energy: Math.sqrt(sum / samplesPerWindow) });
      }
    }

    if (energyWindows.length < 20) return [seg];

    // Find median energy
    var sorted = energyWindows.map(function(w) { return w.energy; }).sort(function(a, b) { return a - b; });
    var median = sorted[Math.floor(sorted.length / 2)];
    var dipThreshold = median * 0.25; // energy drops below 25% of median = potential song break
    var minDipDuration = isRmsTimeline ? 3 : 6; // windows (3s for RMS timeline, 3s for PCM)

    // Find significant energy dips (potential song boundaries)
    var dips = [];
    var dipStart = -1;
    var dipCount = 0;
    for (var di = 0; di < energyWindows.length; di++) {
      if (energyWindows[di].energy < dipThreshold) {
        if (dipStart === -1) dipStart = di;
        dipCount++;
      } else {
        if (dipCount >= minDipDuration) {
          var dipCenter = energyWindows[dipStart + Math.floor(dipCount / 2)].time;
          dips.push(dipCenter);
        }
        dipStart = -1;
        dipCount = 0;
      }
    }

    if (!dips.length) return [seg]; // no internal dips found

    console.log('[RecordingAnalyzer] Found ' + dips.length + ' energy dips in oversized segment (' + Math.round(seg.duration / 60) + 'min, ' + _formatTime(seg.startSec) + '-' + _formatTime(seg.endSec) + ')');

    // Split segment at dip points
    var subSegs = [];
    var prevEnd = seg.startSec;
    dips.forEach(function(dipTime, idx) {
      if (dipTime - prevEnd >= 30) { // minimum 30s sub-segment
        subSegs.push({
          id: seg.id + '_sub' + idx,
          startSec: prevEnd,
          endSec: dipTime,
          duration: dipTime - prevEnd,
          type: (dipTime - prevEnd) >= 120 ? 'song_full' : 'song_partial',
          _originalKind: 'music',
          songTitle: null,
          confidence: 0.3,
          tags: ['auto-split']
        });
      }
      prevEnd = dipTime;
    });
    // Final sub-segment
    if (seg.endSec - prevEnd >= 30) {
      subSegs.push({
        id: seg.id + '_sub' + dips.length,
        startSec: prevEnd,
        endSec: seg.endSec,
        duration: seg.endSec - prevEnd,
        type: (seg.endSec - prevEnd) >= 120 ? 'song_full' : 'song_partial',
        _originalKind: 'music',
        songTitle: null,
        confidence: 0.3,
        tags: ['auto-split']
      });
    }

    console.log('[RecordingAnalyzer] Split into ' + subSegs.length + ' sub-segments: ' + subSegs.map(function(s) { return Math.round(s.duration / 60) + 'm'; }).join(', '));
    return subSegs.length >= 2 ? subSegs : [seg];
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
    _jumpToSong: _jumpToSong,
    _addToNextPlan: _addToNextPlan,
    _selectContext: _selectContext,
    _showContextPicker: _showContextPicker,
    _confirmPlanSongs: _confirmPlanSongs,
    _selectPracticeSong: _selectPracticeSong,
    _filterPracticeSongs: _filterPracticeSongs,
    _showSongConfirmation: _showSongConfirmation,
    _finalizeSongs: _finalizeSongs,
    _skipConfirmation: _skipConfirmation,
    _seekSeg: _seekSeg,
    _nudgeBoundary: _nudgeBoundary,
    _confirmSeg: _confirmSeg,
    _toggleTalkTag: _toggleTalkTag,
    _filterAddSong: _filterAddSong,
    _transcribeSeg: _transcribeSeg,
    _updateTranscript: _updateTranscript,
    _fetchChordHints: _fetchChordHints,
    get _currentAudioUrl() { return _currentAudioUrl; }
  };

})();
