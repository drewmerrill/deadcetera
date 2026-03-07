/**
 * pocket-meter.js — "In The Pocket" Live BPM Monitor
 * GrooveLinx | Works in Rehearsal Mode + Gig/Live Mode
 *
 * Usage:
 *   const pm = new PocketMeter(containerEl, { targetBPM, songKey, bandPath, db, mode });
 *   pm.mount();
 *   pm.destroy();
 *
 * Modes: 'rehearsal' | 'gig'
 *
 * Firebase shape written/read:
 *   /bands/{slug}/songs/{songKey}/liveBPM  — number (broadcast override)
 *   /bands/{slug}/songs/{songKey}/bpm      — number (permanent save)
 */

(function(global) {
  'use strict';

  // ─── BPM Detection Engine ────────────────────────────────────────────────────
  // Spectral-flux rhythmic onset detection via Web Audio API.
  // Detects transient onsets (kick/snare/hi-hat) via frame-to-frame spectral flux
  // in two weighted bands:
  //   • Kick band  50–200 Hz  (weight 0.6) — reliable on phone mics, room bounce
  //   • Snare/hat band 200–8 kHz (weight 0.4) — upper transients
  // Adaptive noise floor prevents false triggers in loud rooms.
  // Passes onset timestamps to GrooveAnalyser for metric computation.

  class BPMEngine {
    constructor(onBPM) {
      this.onBPM   = onBPM;
      this.audioCtx = null;
      this.analyser = null;
      this.stream   = null;
      this.source   = null;
      this.running  = false;
      this.onsets   = [];     // ms timestamps of detected onsets
      this.bufferSize = 2048;
      this.raf      = null;
      this.smoothedBPM = null;

      // Spectral flux state — previous magnitude bins
      this._prevMag     = null;
      // Adaptive noise floor — rolling median of flux values (no-onset frames)
      this._fluxHistory = [];   // last 60 frames of flux
      this._noiseFloor  = 0;
    }

    async start() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = this.bufferSize;
        this.analyser.smoothingTimeConstant = 0;  // raw frames — we handle smoothing
        this.source = this.audioCtx.createMediaStreamSource(this.stream);
        this.source.connect(this.analyser);
        this.running  = true;
        this._prevMag = new Float32Array(this.analyser.frequencyBinCount);
        this._tick();
        return true;
      } catch(e) {
        console.warn('[PocketMeter] Mic error:', e);
        return false;
      }
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.source) this.source.disconnect();
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.audioCtx) this.audioCtx.close();
      this.onsets      = [];
      this.smoothedBPM = null;
      this._prevMag    = null;
      this._fluxHistory = [];
    }

    _tick() {
      if (!this.running) return;
      this.raf = requestAnimationFrame(() => this._tick());

      const freqData = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatFrequencyData(freqData);   // dBFS values

      // Convert dBFS → linear magnitude (0–1)
      const mag = freqData.map(db => Math.pow(10, db / 20));

      const sr     = this.audioCtx.sampleRate;
      const binHz  = sr / this.bufferSize;
      const nBins  = mag.length;
      const bin    = hz => Math.min(Math.floor(hz / binHz), nBins - 1);

      // ── Spectral flux per band ────────────────────────────────────────────
      // Only sum positive increases (half-wave rectify) so decays don't trigger
      const kickFlux  = this._bandFlux(mag, bin(50),   bin(200),  0.6);
      const snapFlux  = this._bandFlux(mag, bin(200),  bin(8000), 0.4);
      const flux      = kickFlux + snapFlux;

      // ── Adaptive noise floor ──────────────────────────────────────────────
      this._fluxHistory.push(flux);
      if (this._fluxHistory.length > 60) this._fluxHistory.shift();
      // Noise floor = lower-quartile of recent flux (robust to occasional loud beats)
      const sorted = [...this._fluxHistory].sort((a, b) => a - b);
      this._noiseFloor = sorted[Math.floor(sorted.length * 0.25)] || 0;

      const sensitivityMult = this._sensitivityMult || 1.4;
      const threshold = this._noiseFloor * sensitivityMult + 0.002;

      // ── Onset detection ───────────────────────────────────────────────────
      const now = performance.now();
      if (flux > threshold) {
        const last = this.onsets[this.onsets.length - 1];
        if (!last || (now - last) > 250) {   // max ~240 BPM
          this.onsets.push(now);
          if (this.onsets.length > 32) this.onsets.shift();
          this._calcBPM();
        }
      }

      this._prevMag = mag;
    }

    _bandFlux(mag, lo, hi, weight) {
      if (!this._prevMag) return 0;
      let flux = 0;
      for (let i = lo; i <= hi; i++) {
        const diff = mag[i] - this._prevMag[i];
        if (diff > 0) flux += diff;   // half-wave rectify
      }
      return (flux / Math.max(1, hi - lo + 1)) * weight;
    }

    _calcBPM() {
      if (this.onsets.length < 4) return;

      // Inter-onset intervals
      const iois = [];
      for (let i = 1; i < this.onsets.length; i++) {
        iois.push(this.onsets[i] - this.onsets[i - 1]);
      }

      // Median filter (robust to occasional double-triggers)
      const sorted = [...iois].sort((a, b) => a - b);
      const med    = sorted[Math.floor(sorted.length / 2)];

      if (med < 250 || med > 2500) return; // 24–240 BPM range

      const rawBPM = 60000 / med;

      if (this.smoothedBPM === null) {
        this.smoothedBPM = rawBPM;
      } else {
        const alpha = this._smoothing || 0.5;
        this.smoothedBPM = this.smoothedBPM * (1 - alpha) + rawBPM * alpha;
      }

      this.onBPM(Math.round(this.smoothedBPM * 10) / 10);
    }
  }

  // ─── Groove Analyser ─────────────────────────────────────────────────────────
  // Computes tempo stability, beat spacing variance, and pocket position
  // from an array of onset timestamps (ms). Used by both live mode and
  // file analysis mode (OfflineAnalyser).

  const GrooveAnalyser = {
    /**
     * @param {number[]} onsets   - ms timestamps
     * @param {number}   targetBPM
     * @returns {{ stabilityScore, spacingVarianceMsRaw, pocketPositionMs,
     *             pocketLabel, iois, medianIOI, targetBeatMs, pctInPocket }}
     */
    analyse(onsets, targetBPM) {
      if (onsets.length < 4) return null;

      const iois = [];
      for (let i = 1; i < onsets.length; i++) iois.push(onsets[i] - onsets[i - 1]);

      // Filter outliers: keep IOIs within 3× the target beat (handles missed beats)
      const targetBeatMs = 60000 / targetBPM;
      const filtered = iois.filter(v => v > targetBeatMs * 0.4 && v < targetBeatMs * 3.0);
      if (filtered.length < 3) return null;

      // Normalise multi-beat gaps: divide by nearest integer multiple
      const normed = filtered.map(v => {
        const mult = Math.round(v / targetBeatMs);
        return v / Math.max(1, mult);
      });

      const n    = normed.length;
      const mean = normed.reduce((a, b) => a + b, 0) / n;

      // Variance + std dev
      const variance = normed.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
      const stdDev   = Math.sqrt(variance);

      // Stability score: 100 = rock-solid, 0 = erratic
      // stdDev of 0ms → 100, stdDev of ≥50ms → 0
      const stabilityScore = Math.round(Math.max(0, 100 - (stdDev / 50) * 100));

      // Pocket position: median IOI vs target beat
      // Positive = dragging (behind), negative = rushing (ahead)
      const sortedN      = [...normed].sort((a, b) => a - b);
      const medianIOI    = sortedN[Math.floor(sortedN.length / 2)];
      const pocketPositionMs = medianIOI - targetBeatMs;
      const absPos       = Math.abs(pocketPositionMs);

      // ── Confidence-weighted pocket label ────────────────────────────────
      // Pocket position is only meaningful when:
      //   (a) enough beats were detected (≥12 for medium, ≥24 for high)
      //   (b) stdDev is low enough that the median is reliable
      //   (c) the offset is large enough relative to spread to be real
      // This prevents overconfident AHEAD/BEHIND labels from noisy mic captures.
      const beatCount    = n;
      const offsetToSpread = stdDev > 0 ? absPos / stdDev : 99; // signal-to-noise

      // Raw direction
      const rawDir = absPos < 3 ? 'CENTERED'
        : pocketPositionMs < 0 ? 'AHEAD'
        : 'BEHIND';

      // Confidence tiers
      // HIGH:   ≥24 beats, stdDev < 20ms, offset > 1.5× spread
      // MEDIUM: ≥12 beats, offset > spread
      // LOW:    anything else → collapse to CENTERED or hedged label
      let pocketLabel, pocketConfidence;
      if (beatCount >= 24 && stdDev < 20 && offsetToSpread > 1.5 && absPos >= 8) {
        pocketLabel      = rawDir;
        pocketConfidence = 'high';
      } else if (beatCount >= 12 && offsetToSpread > 1.0 && absPos >= 12) {
        pocketLabel      = rawDir;
        pocketConfidence = 'medium';
      } else {
        // Not enough confidence to call direction — report as centered
        pocketLabel      = 'CENTERED';
        pocketConfidence = 'low';
      }

      // % samples within ±15ms of target beat period
      const pctInPocket = Math.round(
        normed.filter(v => Math.abs(v - targetBeatMs) <= 15).length / n * 100
      );

      return {
        stabilityScore,
        spacingVarianceMsRaw: Math.round(stdDev * 10) / 10,
        pocketPositionMs:     Math.round(pocketPositionMs * 10) / 10,
        pocketLabel,
        pocketConfidence,   // 'high' | 'medium' | 'low'
        iois: normed,
        medianIOI:    Math.round(medianIOI),
        targetBeatMs: Math.round(targetBeatMs),
        pctInPocket,
      };
    },
  };

  // ─── Offline Analyser ────────────────────────────────────────────────────────
  // Decodes an audio file (ArrayBuffer) and runs the same spectral-flux onset
  // detection engine offline (no mic, no real-time). Returns GrooveAnalyser
  // metrics. Used for recording / board-mix / stem analysis.
  //
  // Source types:
  //   'mic'       — live microphone (handled by BPMEngine, not here)
  //   'recording' — rehearsal recording (full mix, all instruments)
  //   'stem'      — individual stem or board mix (cleanest signal)
  //
  // Note: instrument-level separation is NOT attempted regardless of source.
  // Onset detection on the full mix is sufficient for groove stability analysis.

  class OfflineAnalyser {
    /**
     * @param {ArrayBuffer}  arrayBuffer
     * @param {number}       targetBPM
     * @param {string}       sourceType  'recording' | 'stem'
     * @param {function}     onProgress  (0–1)
     */
    async analyse(arrayBuffer, targetBPM, sourceType, onProgress) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not available');

      onProgress && onProgress(0.05);

      // Decode audio
      const decodeCtx = new AudioCtx();
      let audioBuffer;
      try {
        audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      } finally {
        decodeCtx.close();
      }
      onProgress && onProgress(0.2);

      const sr          = audioBuffer.sampleRate;
      const nChannels   = audioBuffer.numberOfChannels;
      const duration    = audioBuffer.duration;
      const FRAME_SIZE  = 2048;
      const HOP_SIZE    = 512;    // overlap for better time resolution

      // Mix down to mono
      const mono = new Float32Array(audioBuffer.length);
      for (let ch = 0; ch < nChannels; ch++) {
        const chData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < mono.length; i++) mono[i] += chData[i] / nChannels;
      }
      onProgress && onProgress(0.3);

      // Process frames with offline FFT via OfflineAudioContext
      // We process in chunks to avoid blocking the UI thread
      const onsets      = [];
      const CHUNK_SECS  = 10;    // process 10s at a time
      const chunkFrames = Math.floor(CHUNK_SECS * sr);
      const totalFrames = mono.length;
      let offset        = 0;
      let prevMagSlice  = null;
      let noiseHistory  = [];
      let noiseFloor    = 0;
      const binHz       = sr / FRAME_SIZE;
      const bin         = hz => Math.min(Math.floor(hz / binHz), FRAME_SIZE / 2 - 1);
      const kickLo  = bin(50),  kickHi  = bin(200);
      const snapLo  = bin(200), snapHi  = bin(8000);

      while (offset < totalFrames) {
        const end    = Math.min(offset + chunkFrames, totalFrames);
        const slice  = mono.subarray(offset, end);
        const sliceMs = (offset / sr) * 1000;

        // Compute spectral flux for each hop in this chunk
        let frameStart = 0;
        while (frameStart + FRAME_SIZE <= slice.length) {
          const frame  = slice.subarray(frameStart, frameStart + FRAME_SIZE);
          const mag    = this._fft(frame);

          if (prevMagSlice) {
            const kFlux = this._bandFluxOffline(mag, prevMagSlice, kickLo, kickHi, 0.6);
            const sFlux = this._bandFluxOffline(mag, prevMagSlice, snapLo, snapHi, 0.4);
            const flux  = kFlux + sFlux;

            noiseHistory.push(flux);
            if (noiseHistory.length > 120) noiseHistory.shift();
            const sorted = [...noiseHistory].sort((a, b) => a - b);
            noiseFloor = sorted[Math.floor(sorted.length * 0.25)] || 0;

            const threshold = noiseFloor * 1.5 + 0.001;
            const frameTimeMs = sliceMs + (frameStart / sr) * 1000;

            if (flux > threshold) {
              const lastOnset = onsets[onsets.length - 1];
              if (!lastOnset || (frameTimeMs - lastOnset) > 250) {
                onsets.push(frameTimeMs);
              }
            }
          }

          prevMagSlice = mag;
          frameStart  += HOP_SIZE;
        }

        offset += chunkFrames;
        onProgress && onProgress(0.3 + (offset / totalFrames) * 0.6);

        // Yield to UI thread
        await new Promise(r => setTimeout(r, 0));
      }

      onProgress && onProgress(1.0);

      const metrics = GrooveAnalyser.analyse(onsets, targetBPM);
      return { metrics, onsets, duration, sourceType };
    }

    // Minimal DFT magnitude spectrum (no phase) — good enough for flux detection
    // Uses a Hann window to reduce spectral leakage
    _fft(samples) {
      const N   = samples.length;
      const mag = new Float32Array(N / 2);
      for (let k = 0; k < N / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < N; n++) {
          const hann  = 0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1)));
          const angle = (2 * Math.PI * k * n) / N;
          re += samples[n] * hann * Math.cos(angle);
          im -= samples[n] * hann * Math.sin(angle);
        }
        mag[k] = Math.sqrt(re * re + im * im) / N;
      }
      return mag;
    }

    _bandFluxOffline(mag, prev, lo, hi, weight) {
      let flux = 0;
      for (let i = lo; i <= hi; i++) {
        const diff = mag[i] - prev[i];
        if (diff > 0) flux += diff;
      }
      return (flux / Math.max(1, hi - lo + 1)) * weight;
    }
  }

  // ─── Tap Tempo ───────────────────────────────────────────────────────────────

  class TapTempo {
    constructor() {
      this.taps = [];
    }
    tap() {
      const now = performance.now();
      // Reset if gap > 3 seconds
      if (this.taps.length && (now - this.taps[this.taps.length - 1]) > 3000) {
        this.taps = [];
      }
      this.taps.push(now);
      if (this.taps.length > 8) this.taps.shift();
      if (this.taps.length < 2) return null;

      let total = 0;
      for (let i = 1; i < this.taps.length; i++) {
        total += this.taps[i] - this.taps[i - 1];
      }
      return Math.round(60000 / (total / (this.taps.length - 1)));
    }
    reset() { this.taps = []; }
  }

  // ─── Report Helpers ──────────────────────────────────────────────────────────

  function _pmStatCell(label, value, color) {
    return '<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 6px;text-align:center">'
      + '<div style="font-size:12px;font-weight:700;color:' + color + '">' + value + '</div>'
      + '<div style="font-size:9px;color:var(--pm-muted);letter-spacing:0.06em;text-transform:uppercase;margin-top:2px">' + label + '</div>'
      + '</div>';
  }

  function _pmIOIHistogram(iois, targetMs) {
    if (!iois || !iois.length) return '';
    // Build ±60ms histogram with 10ms buckets
    const HALF = 60, BUCKET = 10;
    const buckets = new Array(Math.ceil(HALF * 2 / BUCKET)).fill(0);
    iois.forEach(function(v) {
      const dev = v - targetMs;
      const idx = Math.floor((dev + HALF) / BUCKET);
      if (idx >= 0 && idx < buckets.length) buckets[idx]++;
    });
    const maxCount = Math.max(1, ...buckets);
    const W = 240, H = 36;
    const bw = W / buckets.length;
    let bars = '';
    buckets.forEach(function(count, i) {
      const h   = Math.round((count / maxCount) * H);
      const x   = i * bw;
      const dev = (i * BUCKET) - HALF + BUCKET / 2;
      const col = Math.abs(dev) < BUCKET ? '#4ade80' : Math.abs(dev) < 30 ? '#fbbf24' : '#f87171';
      if (count > 0) bars += '<rect x="' + x.toFixed(1) + '" y="' + (H - h) + '" width="' + (bw - 1).toFixed(1) + '" height="' + h + '" fill="' + col + '" rx="1"/>';
    });
    // Center line
    const cx = (HALF / (HALF * 2)) * W;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:36px">'
      + '<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + H + '" stroke="#4ade80" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.5"/>'
      + bars
      + '</svg>'
      + '<div style="display:flex;justify-content:space-between;font-size:8px;color:var(--pm-muted);margin-top:1px">'
      + '<span>-60ms</span><span style="color:#4ade80">on beat</span><span>+60ms</span></div>';
  }

  // ─── Shared report helpers ───────────────────────────────────────────────────

  // Returns display string + color for pocket position, conservative by default.
  // sourceConfidence: 'high' | 'medium' | 'low'  (from source type, not beat count)
  // groove.pocketConfidence: 'high' | 'medium' | 'low' (from beat count + spread)
  function _pmPocketDisplay(groove, sourceConfidence) {
    // Combined confidence: both data quality AND source quality must be adequate
    const confRank = { high: 3, medium: 2, low: 1 };
    const combined = Math.min(confRank[groove.pocketConfidence], confRank[sourceConfidence]);

    const absMs  = Math.abs(groove.pocketPositionMs);
    const dir    = groove.pocketLabel;  // 'CENTERED' | 'AHEAD' | 'BEHIND'

    let label, color, note;

    if (combined >= 3 && dir !== 'CENTERED') {
      // High confidence — show clear directional label
      label = dir === 'AHEAD' ? '⏩ Ahead' : '⏪ Behind';
      color = '#fbbf24';
      note  = absMs + 'ms ' + (dir === 'AHEAD' ? 'early' : 'late');
    } else if (combined === 2 && dir !== 'CENTERED') {
      // Medium confidence — softer language
      label = dir === 'AHEAD' ? 'Slightly early' : 'Slightly late';
      color = '#fbbf24';
      note  = '~' + absMs + 'ms';
    } else {
      // Low confidence or truly centered
      label = '⏺ Centered';
      color = '#4ade80';
      note  = combined < 2 ? 'limited data' : '';
    }

    return { label, color, note };
  }

  // Source type → confidence tier + display label
  function _pmSourceInfo(sourceType) {
    if (sourceType === 'stem')      return { confidence: 'high',   label: '🎚️ Stem/Mix',   badge: 'Highest confidence' };
    if (sourceType === 'recording') return { confidence: 'medium', label: '🎵 Recording',   badge: 'Good confidence' };
    return                                 { confidence: 'low',    label: '🎙 Live Mic',    badge: 'Estimate only' };
  }

  // ─── PocketMeter ─────────────────────────────────────────────────────────────

  class PocketMeter {
    constructor(container, opts = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      this.targetBPM  = opts.targetBPM  || 120;
      this.songKey    = opts.songKey    || null;
      this.bandPath   = opts.bandPath   || null;  // e.g. 'bands/deadcetera'
      this.db         = opts.db         || (typeof firebase !== 'undefined' ? firebase.database() : null);
      this.mode       = opts.mode       || 'rehearsal'; // 'rehearsal' | 'gig'
      this.onSave     = opts.onSave     || null;  // callback(newBPM)
      // Optional: rehearsal event ID for auto-saving groove analysis to Firebase
      this._rehearsalEventId = opts.rehearsalEventId || null;

      this.liveBPM    = null;
      this.listening  = false;
      this.engine     = null;
      this.tapper     = new TapTempo();
      this.tapTarget  = null;   // BPM from tap (pending lock)
      this.fbRef      = null;
      this.flashTimer = null;
      this.el         = null;

      // Gig mode pulse animation RAF
      this._pulseRaf  = null;
      this._beat      = 0;
      this._lastBeat  = 0;

      // Feature state
      this._multiplier   = 1;
      this._timeSig      = 4;
      this._history      = [];
      this._historyStart = null;
      this._countInTimer = null;
      this._screenFlash  = false;
      this._lastFlashBeat = 0;  // separate from _lastBeat used by gig pulse
      this._smoothing    = 0.5;
      this._sensitivityMult = 1.4;

      // Source + offline analysis
      this._sourceMode    = 'mic';    // 'mic' | 'recording' | 'stem'
      this._offlineResult = null;     // last OfflineAnalyser result
      this._onsets        = [];       // raw onset timestamps for live mode
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    mount() {
      this._injectStyles();
      this._render();
      this._applySettings();
      this._bindEvents();
      this._bindSettingsUI();
      this._subscribeFirebase();
    }

    destroy() {
      this._stopListening();
      if (this.fbRef) this.fbRef.off();
      if (this._pulseRaf) cancelAnimationFrame(this._pulseRaf);
      if (this.el) this.el.remove();
    }

    setTargetBPM(bpm) {
      this.targetBPM = bpm;
      this._updateTarget();
    }

    // ── Firebase ───────────────────────────────────────────────────────────────

    _subscribeFirebase() {
      if (!this.db || !this.bandPath || !this.songKey) return;
      const path = `${this.bandPath}/songs/${this.songKey}/liveBPM`;
      this.fbRef = this.db.ref(path);
      this.fbRef.on('value', snap => {
        const v = snap.val();
        if (v && typeof v === 'number') {
          this.targetBPM = v;
          this._updateTarget();
          this._flashBanner(`🎯 New pocket: ${v} BPM`);
        }
      });
    }

    _broadcastBPM(bpm) {
      if (!this.db || !this.bandPath || !this.songKey) return;
      this.db.ref(`${this.bandPath}/songs/${this.songKey}/liveBPM`).set(bpm);
    }

    _savePermanentBPM(bpm) {
      if (!this.db || !this.bandPath || !this.songKey) return;
      this.db.ref(`${this.bandPath}/songs/${this.songKey}/bpm`).set(bpm);
      // Also clear the liveBPM override
      this.db.ref(`${this.bandPath}/songs/${this.songKey}/liveBPM`).remove();
      if (this.onSave) this.onSave(bpm);
    }

    // ── Mic / Engine ───────────────────────────────────────────────────────────

    async _startListening() {
      // Show a brief explanation before triggering the browser mic prompt
      this._flashBanner('🎙 Allow microphone access when prompted…');
      await new Promise(r => setTimeout(r, 400));
      this.engine = new BPMEngine(bpm => this._onLiveBPM(bpm));
      const ok = await this.engine.start();
      if (!ok) {
        this._showError('Mic access denied');
        return;
      }
      this.listening = true;
      this._updateListenBtn();
      this.el.querySelector('.pm-status-label').textContent = 'LISTENING…';
    }

    _stopListening() {
      const capturedOnsets = this.engine ? [...this.engine.onsets] : [];
      if (this.engine) { this.engine.stop(); this.engine = null; }
      this.listening = false;
      const hadHistory = this._history.length >= 4;
      this.liveBPM = null;
      this._updateListenBtn();
      this._renderGauge(0);
      this._updateGraph();
      const lbl = this.el && this.el.querySelector('.pm-status-label');
      if (lbl) { lbl.textContent = 'STOPPED'; lbl.className = 'pm-status-label pm-status--neutral'; }
      const miniSt = this.el && this.el.querySelector('.pm-mini-status');
      if (miniSt) { miniSt.textContent = 'stopped'; miniSt.style.color = ''; }
      if (hadHistory) this._showDriftReport(capturedOnsets);
    }

    _onLiveBPM(bpm) {
      this.liveBPM = Math.round((bpm * this._multiplier) * 10) / 10;
      if (this._historyStart === null) this._historyStart = Date.now();
      this._history.push({ t: Date.now() - this._historyStart, bpm: this.liveBPM });
      if (this._history.length > 300) this._history.shift();
      this._updateGraph();
      if (this._screenFlash) this._doScreenFlash();
      this._update();
    }

    // ── Core Update ────────────────────────────────────────────────────────────

    _update() {
      if (!this.el || this.liveBPM === null) return;
      const delta = Math.round((this.liveBPM - this.targetBPM) * 10) / 10;
      const absDelta = Math.abs(delta);

      // Status
      let status, zone;
      if (absDelta <= 2)       { status = 'IN THE POCKET'; zone = 'green';  }
      else if (absDelta <= 5)  { status = 'DRIFTING';      zone = 'yellow'; }
      else if (delta > 0)      { status = 'RUSHING';       zone = 'red';    }
      else                     { status = 'DRAGGING';      zone = 'red';    }

      const bpmStr = this.liveBPM.toFixed(1);
      const sign = delta >= 0 ? '+' : '';

      // Update main readout
      this.el.querySelector('.pm-live-bpm').textContent = bpmStr;
      const deltaEl = this.el.querySelector('.pm-delta');
      if (deltaEl) { deltaEl.textContent = sign + delta.toFixed(1) + ' BPM'; deltaEl.className = 'pm-delta pm-delta--' + zone; }
      const statusEl = this.el.querySelector('.pm-status-label');
      if (statusEl) { statusEl.textContent = status; statusEl.className = 'pm-status-label pm-status--' + zone; }

      // Sync mini pill
      const miniVal = this.el.querySelector('.pm-mini-bpm-val');
      if (miniVal) miniVal.textContent = bpmStr;
      const miniSt = this.el.querySelector('.pm-mini-status');
      if (miniSt) { miniSt.textContent = status; miniSt.style.color = zone === 'green' ? 'var(--pm-green)' : zone === 'yellow' ? 'var(--pm-yellow)' : 'var(--pm-red)'; }

      // Gauge arc
      this._renderGauge(delta);

      // Pulse ring on beat (gig mode)
      if (this.mode === 'gig') this._triggerPulse(zone);
    }

    _updateTarget() {
      if (!this.el) return;
      this.el.querySelector('.pm-target-bpm').textContent = this.targetBPM;
      if (this.liveBPM) this._update();
    }

    // ── SVG Gauge ──────────────────────────────────────────────────────────────

    _renderGauge(delta) {
      const svg = this.el.querySelector('.pm-gauge-arc');
      if (!svg) return;

      const range = 10;
      // Hard-clamp delta so needle never escapes the arc
      const clamped = Math.max(-range, Math.min(range, delta));
      const pct = clamped / range; // -1 to +1
      const absDelta = Math.abs(delta);
      const absClamped = Math.abs(clamped);

      // ── Needle ──────────────────────────────────────────────────────────────
      // Arc spans 260 degrees total: ±130 deg from 12 o'clock
      // Scale: 13 deg per BPM (130 / 10 = 13)
      const needleEl = svg.querySelector('.pm-needle');
      if (needleEl) {
        const angleDeg = pct * 130;
        needleEl.setAttribute('transform', `rotate(${angleDeg}, 100, 80)`);
        // Pegged: delta at or beyond max → shimmer red
        needleEl.classList.toggle('pm-needle--pegged', absDelta >= 9.5);
      }

      // ── Color ────────────────────────────────────────────────────────────────
      const color = absDelta <= 2 ? '#4ade80' : absDelta <= 5 ? '#fbbf24' : '#f87171';

      // ── Fill arcs ────────────────────────────────────────────────────────────
      // Each quarter-arc path is 130 degrees = 181.51px of arc length
      const HALF_ARC = 181.51;

      const arcRight = svg.querySelector('.pm-arc-right');
      if (arcRight) {
        if (pct > 0) {
          const len = pct * HALF_ARC;
          arcRight.style.stroke = color;
          arcRight.setAttribute('stroke-dasharray', `${len.toFixed(1)} 999`);
          arcRight.setAttribute('stroke-dashoffset', '0');
        } else {
          arcRight.setAttribute('stroke-dasharray', '0 999');
        }
      }

      // arc-left path goes from left-endpoint → 12 o'clock (clockwise)
      // To fill FROM the center outward (i.e. fill the tail end of the path),
      // use dashoffset = (HALF_ARC - fill_len)
      const arcLeft = svg.querySelector('.pm-arc-left');
      if (arcLeft) {
        if (pct < 0) {
          const len = absClamped * HALF_ARC;
          arcLeft.style.stroke = color;
          arcLeft.setAttribute('stroke-dasharray', `${len.toFixed(1)} 999`);
          arcLeft.setAttribute('stroke-dashoffset', `${(HALF_ARC - len).toFixed(1)}`);
        } else {
          arcLeft.setAttribute('stroke-dasharray', '0 999');
        }
      }

      // In-pocket: clear both fill arcs
      if (absDelta < 1.0) {
        if (arcRight) arcRight.setAttribute('stroke-dasharray', '0 999');
        if (arcLeft)  arcLeft.setAttribute('stroke-dasharray', '0 999');
      }
    }

    // ── Pulse (Gig mode beat flash) ────────────────────────────────────────────

    _triggerPulse(zone) {
      if (this.liveBPM === null) return;
      const now = performance.now();
      const interval = 60000 / this.liveBPM;
      if (now - this._lastBeat < interval * 0.85) return;
      this._lastBeat = now;

      const ring = this.el.querySelector('.pm-pulse-ring');
      if (!ring) return;
      ring.style.borderColor = zone === 'green' ? '#4ade80' : zone === 'yellow' ? '#fbbf24' : '#f87171';
      ring.classList.remove('pm-pulse-anim');
      void ring.offsetWidth; // reflow
      ring.classList.add('pm-pulse-anim');
    }

    // ── Tap Tempo ──────────────────────────────────────────────────────────────

    _onTap() {
      const bpm = this.tapper.tap();
      if (!bpm) return;
      this.tapTarget = bpm;
      this.el.querySelector('.pm-tap-readout').textContent = bpm + ' BPM';
      this.el.querySelector('.pm-broadcast-btn').classList.remove('pm-hidden');
      this.el.querySelector('.pm-lock-btn').classList.remove('pm-hidden');
      // Flash the tap button
      const btn = this.el.querySelector('.pm-tap-btn');
      btn.classList.add('pm-tap-flash');
      setTimeout(() => btn.classList.remove('pm-tap-flash'), 100);
    }

    _onBroadcast() {
      if (!this.tapTarget) return;
      this.targetBPM = this.tapTarget;
      this._broadcastBPM(this.tapTarget);
      this._updateTarget();
      this._flashBanner(`📡 Broadcast: ${this.tapTarget} BPM → all members`);
      this.tapper.reset();
      this.tapTarget = null;
      this.el.querySelector('.pm-tap-readout').textContent = 'Tap Tempo';
      this.el.querySelector('.pm-broadcast-btn').classList.add('pm-hidden');
      this.el.querySelector('.pm-lock-btn').classList.add('pm-hidden');
    }

    _onLock() {
      if (!this.tapTarget) return;
      this._savePermanentBPM(this.tapTarget);
      this._broadcastBPM(this.tapTarget);
      this.targetBPM = this.tapTarget;
      this._updateTarget();
      this._flashBanner(`💾 Saved ${this.tapTarget} BPM as new default`);
      this.tapper.reset();
      this.tapTarget = null;
      this.el.querySelector('.pm-tap-readout').textContent = 'Tap Tempo';
      this.el.querySelector('.pm-broadcast-btn').classList.add('pm-hidden');
      this.el.querySelector('.pm-lock-btn').classList.add('pm-hidden');
    }

    _flashBanner(msg) {
      const b = this.el.querySelector('.pm-banner');
      if (!b) return;
      b.textContent = msg;
      b.classList.add('pm-banner--show');
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => b.classList.remove('pm-banner--show'), 3000);
    }

    _showError(msg) {
      this._flashBanner('⚠️ ' + msg);
    }

    _updateListenBtn() {
      const btn = this.el && this.el.querySelector('.pm-listen-btn');
      if (!btn) return;
      btn.textContent = this.listening ? '⏹ Stop' : '🎙 Listen';
      btn.classList.toggle('pm-listen--active', this.listening);
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    _bindEvents() {
      this.el.querySelector('.pm-listen-btn').addEventListener('click', () => {
        if (this.listening) this._stopListening();
        else this._startListening();
      });
      this.el.querySelector('.pm-tap-btn').addEventListener('click', () => this._onTap());
      this.el.querySelector('.pm-broadcast-btn').addEventListener('click', () => this._onBroadcast());
      this.el.querySelector('.pm-lock-btn').addEventListener('click', () => this._onLock());
      this.el.querySelector('.pm-countin-btn').addEventListener('click', () => this._onCountIn());
      this.el.querySelector('.pm-drift-close').addEventListener('click', () => {
        this.el.querySelector('.pm-drift-report').classList.add('pm-hidden');
      });
      this.el.querySelectorAll('.pm-mult-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.el.querySelectorAll('.pm-mult-btn').forEach(b => b.classList.remove('pm-mult--active'));
          btn.classList.add('pm-mult--active');
          if (btn.classList.contains('pm-mult--half')) this._multiplier = 0.5;
          else if (btn.classList.contains('pm-mult--2x')) this._multiplier = 2;
          else this._multiplier = 1;
        });
      });
      this.el.querySelectorAll('.pm-sig-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.el.querySelectorAll('.pm-sig-btn').forEach(b => b.classList.remove('pm-sig--active'));
          btn.classList.add('pm-sig--active');
          if (btn.classList.contains('pm-sig--3')) this._timeSig = 3;
          else if (btn.classList.contains('pm-sig--6')) this._timeSig = 6;
          else this._timeSig = 4;
        });
      });
      this.el.querySelector('.pm-flash-btn').addEventListener('click', () => {
        this._screenFlash = !this._screenFlash;
        this.el.querySelector('.pm-flash-btn').classList.toggle('pm-flash-btn--active', this._screenFlash);
        this._flashBanner(this._screenFlash ? 'Screen flash ON' : 'Screen flash OFF');
      });

      // ── BPM +/− adjustment ────────────────────────────────────────────────
      this._pendingBPM = null;
      this.el.querySelectorAll('.pm-bpm-adj').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = parseInt(btn.dataset.dir);
          this.targetBPM = Math.max(20, Math.min(300, (this.targetBPM || 120) + dir));
          this._updateTarget();
          // Show save prompt if we have a song to save to
          this._pendingBPM = this.targetBPM;
          const prompt = this.el.querySelector('.pm-bpm-prompt');
          const valEl = this.el.querySelector('.pm-bpm-prompt-val');
          if (prompt && valEl) {
            valEl.textContent = this.targetBPM;
            prompt.classList.remove('pm-hidden');
          }
        });
      });
      this.el.querySelector('.pm-bpm-save-yes').addEventListener('click', () => {
        if (this._pendingBPM && this.songKey && this.db) {
          try {
            var ref = this.db.ref(this.bandPath + '/songs/' + this.songKey + '/bpm');
            ref.set(this._pendingBPM);
            // Also update global app state if available
            if (typeof selectedSong !== 'undefined' && selectedSong) selectedSong.bpm = this._pendingBPM;
            this._flashBanner('✅ BPM saved to song (' + this._pendingBPM + ')');
          } catch(e) { this._flashBanner('⚠️ Could not save BPM: ' + e.message); }
        }
        this.el.querySelector('.pm-bpm-prompt').classList.add('pm-hidden');
        this._pendingBPM = null;
      });
      this.el.querySelector('.pm-bpm-save-no').addEventListener('click', () => {
        this.el.querySelector('.pm-bpm-prompt').classList.add('pm-hidden');
        this._pendingBPM = null;
      });

      // ── Settings gear ──────────────────────────────────────────────────────
      this.el.querySelector('.pm-settings-btn').addEventListener('click', () => {
        const panel = this.el.querySelector('.pm-settings-panel');
        const btn   = this.el.querySelector('.pm-settings-btn');
        if (!panel) return;
        const open = panel.classList.toggle('pm-hidden');
        if (btn) btn.classList.toggle('pm-active', !open);
      });

      // ── View mode (full / float / mini) ────────────────────────────────────
      this._viewMode = 'full';
      this.el.querySelectorAll('.pm-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.view;
          if (mode) this._setViewMode(mode);
        });
      });

      // ── Drag support for float + mini modes ────────────────────────────────
      this._initDrag();

      // ── Audio source selector ─────────────────────────────────────────────
      this.el.querySelectorAll('.pm-src-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._sourceMode = btn.dataset.src;
          this.el.querySelectorAll('.pm-src-btn').forEach(b => b.classList.remove('pm-src--active'));
          btn.classList.add('pm-src--active');
          const isMic = this._sourceMode === 'mic';
          this.el.querySelector('.pm-controls--mic').classList.toggle('pm-hidden', !isMic);
          this.el.querySelector('.pm-controls--file').classList.toggle('pm-hidden', isMic);
          // Stop any active listening when switching sources
          if (!isMic && this.listening) this._stopListening();
        });
      });

      // ── File picker + analyze ─────────────────────────────────────────────
      const fileInput  = this.el.querySelector('.pm-file-input');
      const fileLabel  = this.el.querySelector('.pm-file-name');
      const analyzeBtn = this.el.querySelector('.pm-analyze-btn');

      if (fileInput) {
        fileInput.addEventListener('change', () => {
          const f = fileInput.files[0];
          if (!f) return;
          if (fileLabel) fileLabel.textContent = f.name.length > 28 ? f.name.slice(0, 25) + '…' : f.name;
          if (analyzeBtn) analyzeBtn.classList.remove('pm-hidden');
        });
      }

      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => this._runFileAnalysis());
      }
    }

    // ── File Analysis ─────────────────────────────────────────────────────────

    async _runFileAnalysis() {
      const fileInput = this.el.querySelector('.pm-file-input');
      const f = fileInput && fileInput.files[0];
      if (!f) return;

      const progress  = this.el.querySelector('.pm-progress-wrap');
      const fill      = this.el.querySelector('.pm-progress-fill');
      const lbl       = this.el.querySelector('.pm-progress-label');
      const analyzeBtn = this.el.querySelector('.pm-analyze-btn');
      if (analyzeBtn) analyzeBtn.disabled = true;
      if (progress) progress.classList.remove('pm-hidden');
      if (lbl) lbl.textContent = 'Decoding audio…';

      try {
        const arrayBuffer = await f.arrayBuffer();
        const analyser = new OfflineAnalyser();
        const result   = await analyser.analyse(
          arrayBuffer,
          this.targetBPM,
          this._sourceMode,   // 'recording' or 'stem'
          (pct) => {
            if (fill) fill.style.width = Math.round(pct * 100) + '%';
            if (lbl) lbl.textContent = pct < 0.3 ? 'Decoding audio…' : pct < 0.9 ? 'Detecting onsets…' : 'Computing groove…';
          }
        );
        // Attach file name and rehearsal context for Firebase save
        result.sourceFile = f.name;
        this._offlineResult = result;
        if (progress) progress.classList.add('pm-hidden');
        if (analyzeBtn) { analyzeBtn.disabled = false; analyzeBtn.textContent = '↺ Re-analyze'; }
        this._showFileReport(result);
      } catch(e) {
        console.error('[PocketMeter] File analysis error:', e);
        if (progress) progress.classList.add('pm-hidden');
        if (analyzeBtn) { analyzeBtn.disabled = false; }
        this._flashBanner('⚠️ Could not analyze file: ' + e.message);
      }
    }

    // -- View Modes ------------------------------------------------------------

    _setViewMode(mode) {
      this._viewMode = mode;
      this.el.classList.remove('pm-float', 'pm-mini');
      if (mode === 'float') {
        document.body.appendChild(this.el);
        this.el.classList.add('pm-float');
        this._flashBanner('Float mode — drag to reposition');
      } else if (mode === 'mini') {
        document.body.appendChild(this.el);
        this.el.classList.add('pm-mini');
        var miniVal = this.el.querySelector('.pm-mini-bpm-val');
        if (miniVal) miniVal.textContent = this.liveBPM > 0 ? this.liveBPM.toFixed(1) : '—';
        this._flashBanner('Mini — drag to reposition');
      } else {
        if (this.container) this.container.appendChild(this.el);
        ['position','left','top','bottom','right','width'].forEach(function(p) {
          this.el.style[p] = '';
        }.bind(this));
      }
    }

    _initDrag() {
      let startX, startY, origLeft, origTop;
      const onMouseMove = (e) => {
        if (!this.el.classList.contains('pm-float') && !this.el.classList.contains('pm-mini')) return;
        const dx = (e.clientX || e.touches[0].clientX) - startX;
        const dy = (e.clientY || e.touches[0].clientY) - startY;
        this.el.style.left   = (origLeft + dx) + 'px';
        this.el.style.top    = (origTop  + dy) + 'px';
        this.el.style.bottom = 'auto';
        this.el.style.right  = 'auto';
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
        document.removeEventListener('touchmove', onMouseMove);
        document.removeEventListener('touchend',  onMouseUp);
      };
      this.el.addEventListener('mousedown', (e) => {
        // Don't drag when clicking buttons/inputs
        if (e.target.closest('button,input,select,textarea')) return;
        if (!this.el.classList.contains('pm-float') && !this.el.classList.contains('pm-mini')) return;
        const rect = this.el.getBoundingClientRect();
        startX   = e.clientX; startY = e.clientY;
        origLeft = rect.left;  origTop = rect.top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
        e.preventDefault();
      });
      this.el.addEventListener('touchstart', (e) => {
        if (e.target.closest('button,input,select,textarea')) return;
        if (!this.el.classList.contains('pm-float') && !this.el.classList.contains('pm-mini')) return;
        const rect = this.el.getBoundingClientRect();
        startX   = e.touches[0].clientX; startY = e.touches[0].clientY;
        origLeft = rect.left;             origTop = rect.top;
        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('touchend',  onMouseUp);
        e.preventDefault();
      }, { passive: false });
    }

    // -- Calibration settings -------------------------------------------------

    _getSetting(key, def) {
      try { return localStorage.getItem('pm_cal_' + key) || def; } catch(e) { return def; }
    }
    _saveSetting(key, val) {
      try { localStorage.setItem('pm_cal_' + key, val); } catch(e) {}
    }
    _applySettings() {
      const r = parseInt(this._getSetting('reactivity', '3'));
      this._smoothing = [0.85, 0.7, 0.5, 0.35, 0.2][r - 1];
      const s = parseInt(this._getSetting('sensitivity', '3'));
      this._sensitivityMult = [2.0, 1.7, 1.4, 1.25, 1.1][s - 1];
    }
    _bindSettingsUI() {
      const senSlider = this.el.querySelector('.pm-cal-sensitivity');
      const reactSlider = this.el.querySelector('.pm-cal-reactivity');
      if (senSlider) senSlider.addEventListener('input', () => {
        this._saveSetting('sensitivity', senSlider.value); this._applySettings();
      });
      if (reactSlider) reactSlider.addEventListener('input', () => {
        this._saveSetting('reactivity', reactSlider.value); this._applySettings();
      });
    }

    // -- Count-In --------------------------------------------------------------

    _onCountIn() {
      if (this._countInTimer) {
        clearInterval(this._countInTimer); this._countInTimer = null;
        const btn = this.el.querySelector('.pm-countin-btn');
        if (btn) btn.textContent = 'Count In';
        return;
      }
      if (this.listening) { this._stopListening(); return; }
      const bpm = this.tapTarget || this.targetBPM;
      const interval = 60000 / bpm;
      const beats = this._timeSig === 6 ? 6 : this._timeSig === 3 ? 3 : 4;
      let count = 0;
      const btn = this.el.querySelector('.pm-countin-btn');
      const lbl = this.el.querySelector('.pm-status-label');
      let ctx;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
      const click = (accent) => {
        if (!ctx) return;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = accent ? 1200 : 800;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      };
      click(true); if (lbl) lbl.textContent = '1'; count = 1;
      if (btn) btn.textContent = '⏹ CANCEL';
      this._countInTimer = setInterval(() => {
        count++; click(count === 1);
        if (lbl) lbl.textContent = count <= beats ? String(count) : '';
        if (count >= beats) {
          clearInterval(this._countInTimer); this._countInTimer = null;
          if (btn) btn.textContent = 'Count In';
          setTimeout(() => this._startListening(), interval * 0.5);
        }
      }, interval);
    }

    // -- Screen Flash ----------------------------------------------------------

    _doScreenFlash() {
      const overlay = this.el && this.el.querySelector('.pm-flash-overlay');
      if (!overlay) return;
      const now = performance.now();
      const interval = 60000 / (this.liveBPM || this.targetBPM);
      // Enforce strict minimum interval — no flashing faster than once per beat, min 300ms
      if (now - this._lastFlashBeat < Math.max(interval * 0.9, 300)) return;
      this._lastFlashBeat = now;
      const delta = this.liveBPM ? Math.abs(this.liveBPM - this.targetBPM) : 0;
      const color = delta <= 2 ? 'rgba(0,255,136,0.10)' : delta <= 5 ? 'rgba(255,204,0,0.10)' : 'rgba(255,59,59,0.10)';
      overlay.style.background = color;
      overlay.style.opacity = '1';
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => { if (overlay) overlay.style.opacity = '0'; }, 60);
    }

    // -- Tempo History Graph ---------------------------------------------------

    _updateGraph() {
      const svg = this.el && this.el.querySelector('.pm-history-graph');
      if (!svg) return;
      if (!this._history.length) {
        const l = svg.querySelector('.pm-graph-line'); if (l) l.setAttribute('points', ''); return;
      }
      const W = 280, H = 60, pad = 4, target = this.targetBPM;
      const lo = target - 15, hi = target + 15;
      const maxT = this._history[this._history.length - 1].t || 1000;
      const xS = (W - pad*2) / maxT, yS = (H - pad*2) / (hi - lo);
      const pts = this._history.map(p => {
        const x = pad + p.t * xS;
        const y = H - pad - (Math.min(hi, Math.max(lo, p.bpm)) - lo) * yS;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      const ty = (H - pad - (target - lo) * yS).toFixed(1);
      const tl = svg.querySelector('.pm-graph-target-line');
      if (tl) { tl.setAttribute('y1', ty); tl.setAttribute('y2', ty); }
      const bpms = this._history.map(p => p.bpm);
      const avg = bpms.reduce((a,b) => a + Math.abs(b-target), 0) / bpms.length;
      const col = avg <= 2 ? '#00ff88' : avg <= 5 ? '#ffcc00' : '#ff4444';
      const pl = svg.querySelector('.pm-graph-line');
      if (pl) { pl.setAttribute('points', pts); pl.setAttribute('stroke', col); }
    }

    // -- Drift Report ----------------------------------------------------------

    _showDriftReport(onsets) {
      if (!this._history.length) return;
      const bpms   = this._history.map(p => p.bpm);
      const target = this.targetBPM;
      const dur    = Math.round(this._history[this._history.length - 1].t / 1000);
      this._history = []; this._historyStart = null;

      const report = this.el && this.el.querySelector('.pm-drift-report');
      const body   = this.el && this.el.querySelector('.pm-drift-body');
      if (!report || !body) return;

      // Run GrooveAnalyser on captured onset timestamps
      const groove = (onsets && onsets.length >= 4)
        ? GrooveAnalyser.analyse(onsets, target)
        : null;

      // Live mic = low source confidence (phone mic, room reflections)
      const srcInfo = _pmSourceInfo('mic');

      // Fallback BPM-history metrics (always available from smoothed BPM stream)
      const avg     = bpms.reduce((a, b) => a + b, 0) / bpms.length;
      const maxRush = Math.max(...bpms.map(b => b - target));
      const maxDrag = Math.min(...bpms.map(b => b - target));
      const pct     = Math.round(bpms.filter(b => Math.abs(b - target) <= 2).length / bpms.length * 100);

      let html = '';

      // Source confidence badge
      html += '<div style="text-align:center;margin-bottom:10px">'
        + '<span style="font-size:9px;letter-spacing:0.1em;color:var(--pm-muted);text-transform:uppercase;'
        + 'background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:10px">'
        + srcInfo.label + ' · ' + srcInfo.badge
        + '</span></div>';

      if (groove) {
        const sc      = groove.stabilityScore;
        const scCol   = sc >= 80 ? '#4ade80' : sc >= 55 ? '#fbbf24' : '#f87171';
        const scGrade = sc >= 80 ? 'Rock Solid' : sc >= 65 ? 'Pretty Tight' : sc >= 50 ? 'Drifting' : 'Loose';
        const pocket  = _pmPocketDisplay(groove, srcInfo.confidence);
        const varCol  = groove.spacingVarianceMsRaw < 10 ? '#4ade80' : groove.spacingVarianceMsRaw < 25 ? '#fbbf24' : '#f87171';
        const pctCol  = groove.pctInPocket >= 75 ? '#4ade80' : groove.pctInPocket >= 55 ? '#fbbf24' : '#f87171';

        html +=
          // Hero: Tempo Stability Score
          '<div style="text-align:center;margin-bottom:14px">'
          + '<div style="font-size:52px;font-weight:800;line-height:1;color:' + scCol + '">' + sc + '</div>'
          + '<div style="font-size:10px;letter-spacing:0.12em;color:var(--pm-muted);text-transform:uppercase;margin-top:2px">Tempo Stability</div>'
          + '<div style="font-size:13px;font-weight:700;color:' + scCol + ';margin-top:4px">' + scGrade + '</div>'
          + '</div>'
          // Three supporting metrics
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">'
          + _pmStatCell('Beat Variance', groove.spacingVarianceMsRaw + 'ms', varCol)
          + _pmStatCell('Pocket', pocket.note ? pocket.label + '<br><span style="font-size:8px;opacity:0.7">' + pocket.note + '</span>' : pocket.label, pocket.color)
          + _pmStatCell('In Pocket', groove.pctInPocket + '%', pctCol)
          + '</div>'
          // Beat spacing histogram
          + '<div style="margin-bottom:10px">'
          + '<div style="font-size:9px;color:var(--pm-muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Beat Spacing Distribution</div>'
          + _pmIOIHistogram(groove.iois, groove.targetBeatMs)
          + '</div>';
      }

      // Fallback stats (always shown as secondary detail)
      const grade = pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴';
      html +=
        '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:4px">'
        + '<div class="pm-drift-stat">' + grade + ' <span>' + pct + '%</span> BPM in pocket</div>'
        + '<div class="pm-drift-stat">🎯 Avg <span>' + avg.toFixed(1) + ' BPM</span> · target ' + target + '</div>'
        + '<div class="pm-drift-stat">⏩ Rush <span>+' + maxRush.toFixed(1) + '</span> · ⏪ Drag <span>' + maxDrag.toFixed(1) + '</span></div>'
        + '<div class="pm-drift-stat">⏱ <span>' + dur + 's</span> session</div>'
        + '</div>';

      body.innerHTML = html;
      report.classList.remove('pm-hidden');
    }

    _showFileReport(result) {
      const report = this.el && this.el.querySelector('.pm-drift-report');
      const body   = this.el && this.el.querySelector('.pm-drift-body');
      if (!report || !body) return;

      const groove = result.metrics;
      if (!groove) {
        body.innerHTML = '<div class="pm-drift-stat">⚠️ Not enough onsets detected. Try a louder or cleaner source, or lower sensitivity.</div>';
        report.classList.remove('pm-hidden');
        return;
      }

      const srcInfo = _pmSourceInfo(result.sourceType);
      const pocket  = _pmPocketDisplay(groove, srcInfo.confidence);
      const sc      = groove.stabilityScore;
      const scCol   = sc >= 80 ? '#4ade80' : sc >= 55 ? '#fbbf24' : '#f87171';
      const scGrade = sc >= 80 ? 'Rock Solid' : sc >= 65 ? 'Pretty Tight' : sc >= 50 ? 'Drifting' : 'Loose';
      const durStr  = result.duration ? Math.round(result.duration) + 's' : '—';
      const varCol  = groove.spacingVarianceMsRaw < 10 ? '#4ade80' : groove.spacingVarianceMsRaw < 25 ? '#fbbf24' : '#f87171';
      const pctCol  = groove.pctInPocket >= 75 ? '#4ade80' : groove.pctInPocket >= 55 ? '#fbbf24' : '#f87171';

      // Build saved-to-rehearsal status area (filled in after save attempt)
      const savedId = 'pm-save-status-' + Date.now();

      body.innerHTML =
        // Source + confidence badge
        '<div style="text-align:center;margin-bottom:12px">'
        + '<span style="font-size:9px;letter-spacing:0.1em;color:var(--pm-muted);text-transform:uppercase;'
        + 'background:rgba(255,255,255,0.05);padding:3px 10px;border-radius:10px">'
        + srcInfo.label + ' · ' + srcInfo.badge
        + '</span>'
        + '<div style="font-size:9px;color:var(--pm-muted);margin-top:4px">'
        + durStr + ' · ' + groove.iois.length + ' beats detected'
        + '</div>'
        + '</div>'
        // Hero: Tempo Stability Score
        + '<div style="text-align:center;margin-bottom:14px">'
        + '<div style="font-size:56px;font-weight:800;line-height:1;color:' + scCol + '">' + sc + '</div>'
        + '<div style="font-size:10px;letter-spacing:0.12em;color:var(--pm-muted);text-transform:uppercase;margin-top:2px">Groove Stability Score</div>'
        + '<div style="font-size:14px;font-weight:700;color:' + scCol + ';margin-top:4px">' + scGrade + '</div>'
        + '</div>'
        // Three supporting metrics
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">'
        + _pmStatCell('Beat Variance', groove.spacingVarianceMsRaw + 'ms', varCol)
        + _pmStatCell('Pocket', pocket.note
            ? pocket.label + '<br><span style="font-size:8px;opacity:0.7">' + pocket.note + '</span>'
            : pocket.label, pocket.color)
        + _pmStatCell('In Pocket', groove.pctInPocket + '%', pctCol)
        + '</div>'
        // Beat spacing histogram
        + '<div style="margin-bottom:12px">'
        + '<div style="font-size:9px;color:var(--pm-muted);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px">Beat Spacing Distribution</div>'
        + _pmIOIHistogram(groove.iois, groove.targetBeatMs)
        + '</div>'
        // Detail stats
        + '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px">'
        + '<div class="pm-drift-stat">🎯 Target beat <span>' + groove.targetBeatMs + 'ms</span> · Median actual <span>' + groove.medianIOI + 'ms</span></div>'
        + '<div class="pm-drift-stat">📐 Pocket offset <span>' + (groove.pocketPositionMs >= 0 ? '+' : '') + groove.pocketPositionMs + 'ms</span>'
        + (groove.pocketConfidence === 'low' ? ' <span style="font-size:9px;color:var(--pm-muted)">(low confidence)</span>' : '')
        + '</div>'
        + (result.sourceType !== 'stem'
            ? '<div style="font-size:9px;color:var(--pm-muted);margin-top:6px;line-height:1.5">'
              + 'ℹ️ Groove measured from full mix onset detection. '
              + 'For cleaner results, upload individual stems.</div>'
            : '')
        + '</div>'
        // Rehearsal save status area
        + '<div id="' + savedId + '" style="margin-top:10px;font-size:10px;text-align:center;color:var(--pm-muted)"></div>';

      report.classList.remove('pm-hidden');

      // ── Auto-save to rehearsal record if context exists ───────────────────
      this._saveGrooveToRehearsal(result, savedId);
    }

    _saveGrooveToRehearsal(result, statusElId) {
      // Only save if we have a rehearsal context (eventId) and Firebase
      if (!this.db || !this.bandPath || !this._rehearsalEventId) return;

      const groove   = result.metrics;
      const record   = {
        savedAt:          new Date().toISOString(),
        sourceType:       result.sourceType,
        sourceFile:       result.sourceFile || null,
        duration:         result.duration ? Math.round(result.duration) : null,
        targetBPM:        this.targetBPM,
        stabilityScore:   groove.stabilityScore,
        spacingVarianceMs: groove.spacingVarianceMsRaw,
        pocketPositionMs: groove.pocketPositionMs,
        pocketLabel:      groove.pocketLabel,
        pocketConfidence: groove.pocketConfidence,
        pctInPocket:      groove.pctInPocket,
        beatCount:        groove.iois.length,
      };

      const path = this.bandPath + '/rehearsals/' + this._rehearsalEventId + '/grooveAnalysis';
      this.db.ref(path).set(record).then(function() {
        var el = document.getElementById(statusElId);
        if (el) {
          el.textContent = '✅ Saved to rehearsal record';
          el.style.color = '#4ade80';
        }
      }).catch(function(e) {
        console.warn('[PocketMeter] Could not save groove analysis:', e);
        var el = document.getElementById(statusElId);
        if (el) {
          el.textContent = '⚠️ Could not save to rehearsal';
          el.style.color = 'var(--pm-muted)';
        }
      });
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    _render() {
      const div = document.createElement('div');
      div.className = `pm-root pm-mode-${this.mode}`;
      div.innerHTML = `
        <div class="pm-banner"></div>
        <div class="pm-flash-overlay"></div>

        <!-- Header row: target BPM + gear + view controls -->
        <div class="pm-header">
          <div class="pm-header-left">
            <span class="pm-header-label">TARGET</span>
            <div class="pm-target-row">
              <button class="pm-bpm-adj" data-dir="-1" title="Decrease target BPM">−</button>
              <div class="pm-target-bpm">${this.targetBPM}</div>
              <button class="pm-bpm-adj" data-dir="1" title="Increase target BPM">+</button>
            </div>
            <span class="pm-header-label">BPM</span>
          </div>
          <div class="pm-header-right">
            <button class="pm-settings-btn" title="Calibration">⚙</button>
          </div>
        </div>

        <!-- Toolbar: multiplier + time sig + flash -->
        <div class="pm-toolbar">
          <button class="pm-mult-btn pm-mult--half">½x</button>
          <button class="pm-mult-btn pm-mult--1x pm-mult--active">1x</button>
          <button class="pm-mult-btn pm-mult--2x">2x</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-sig-btn pm-sig--3">3/4</button>
          <button class="pm-sig-btn pm-sig--4 pm-sig--active">4/4</button>
          <button class="pm-sig-btn pm-sig--6">6/8</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-flash-btn" title="Screen flash on beat">⚡</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-view-btn" data-view="float" title="Float over other pages">⧉</button>
          <button class="pm-view-btn" data-view="mini" title="Mini pill">▾</button>
        </div>

        <!-- Calibration panel (hidden by default) -->
        <div class="pm-settings-panel pm-hidden">
          <div class="pm-settings-title">Calibration</div>
          <div class="pm-settings-row">
            <label class="pm-settings-label">Sensitivity</label>
            <div class="pm-settings-track">
              <span class="pm-settings-hint">Low</span>
              <input type="range" class="pm-cal-sensitivity" min="1" max="5" step="1" value="${this._getSetting('sensitivity','3')}">
              <span class="pm-settings-hint">High</span>
            </div>
            <div class="pm-settings-desc">Low = only loud beats · High = catches subtle playing</div>
          </div>
          <div class="pm-settings-row">
            <label class="pm-settings-label">Reactivity</label>
            <div class="pm-settings-track">
              <span class="pm-settings-hint">Smooth</span>
              <input type="range" class="pm-cal-reactivity" min="1" max="5" step="1" value="${this._getSetting('reactivity','3')}">
              <span class="pm-settings-hint">Snappy</span>
            </div>
            <div class="pm-settings-desc">Smooth = stable number · Snappy = fast response</div>
          </div>
        </div>

        <!-- Gauge -->
        <div class="pm-gauge-wrap">
          <div class="pm-pulse-ring"></div>
          <svg class="pm-gauge-arc" viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="pm-glow-green"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="pm-glow-red"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <!-- Track -->
            <path class="pm-arc-track" d="M 38.7 131.4 A 80 80 0 1 1 161.3 131.4" fill="none" stroke="#1e1e2e" stroke-width="14" stroke-linecap="round"/>
            <!-- Green pocket zone -->
            <path class="pm-arc-zone-green" d="M 38.7 131.4 A 80 80 0 1 1 161.3 131.4" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-dasharray="72.6 999" stroke-dashoffset="-145.2" opacity="0.5"/>
            <!-- Active fill right (rushing) -->
            <path class="pm-arc-right" d="M 100 0 A 80 80 0 0 1 161.3 131.4" fill="none" stroke="#f87171" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 999"/>
            <!-- Active fill left (dragging) -->
            <path class="pm-arc-left" d="M 38.7 131.4 A 80 80 0 0 1 100 0" fill="none" stroke="#f87171" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 999" stroke-dashoffset="181.5"/>
            <!-- Ticks -->
            <g stroke-linecap="round">
              <line x1="100" y1="0" x2="100" y2="12" stroke="#333" stroke-width="2" transform="rotate(-130 100 80)"/>
              <line x1="100" y1="0" x2="100" y2="8"  stroke="#333" stroke-width="1.5" transform="rotate(-65 100 80)"/>
              <line x1="100" y1="0" x2="100" y2="14" stroke="#4ade80" stroke-width="2.5"/>
              <line x1="100" y1="0" x2="100" y2="8"  stroke="#333" stroke-width="1.5" transform="rotate(65 100 80)"/>
              <line x1="100" y1="0" x2="100" y2="12" stroke="#333" stroke-width="2" transform="rotate(130 100 80)"/>
            </g>
            <!-- Labels -->
            <text x="28" y="136" font-family="system-ui,sans-serif" font-size="8" fill="#444" text-anchor="middle">−10</text>
            <text x="172" y="136" font-family="system-ui,sans-serif" font-size="8" fill="#444" text-anchor="middle">+10</text>
            <!-- Pivot -->
            <circle cx="100" cy="80" r="7" fill="#12121f" stroke="#2a2a3e" stroke-width="2"/>
            <!-- Needle -->
            <g class="pm-needle">
              <line x1="100" y1="80" x2="100" y2="8" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
              <circle cx="100" cy="80" r="4" fill="#e2e8f0"/>
            </g>
          </svg>

          <!-- BPM readout centered in arc bowl -->
          <div class="pm-center-readout">
            <div class="pm-live-label">LIVE BPM</div>
            <div class="pm-live-bpm">—</div>
            <div class="pm-delta pm-delta--neutral">±0.0</div>
          </div>
        </div>

        <!-- Status -->
        <div class="pm-status-label pm-status--neutral">STANDBY</div>

        <!-- Audio source selector -->
        <div class="pm-source-bar">
          <button class="pm-src-btn pm-src--active" data-src="mic">🎙 Live Mic</button>
          <button class="pm-src-btn" data-src="recording">🎵 Recording</button>
          <button class="pm-src-btn" data-src="stem">🎚️ Stem/Mix</button>
        </div>

        <!-- Main controls (live mic) -->
        <div class="pm-controls pm-controls--mic">
          <button class="pm-listen-btn">🎙 Listen</button>
          <button class="pm-tap-btn">Tap</button>
        </div>

        <!-- File controls (recording / stem) -->
        <div class="pm-controls pm-controls--file pm-hidden">
          <label class="pm-file-label">
            <input type="file" class="pm-file-input" accept="audio/*" style="display:none">
            <span class="pm-file-name">Choose audio file…</span>
          </label>
          <button class="pm-analyze-btn pm-hidden">▶ Analyze</button>
        </div>

        <!-- File analysis progress -->
        <div class="pm-progress-wrap pm-hidden">
          <div class="pm-progress-bar"><div class="pm-progress-fill" style="width:0%"></div></div>
          <div class="pm-progress-label">Analyzing…</div>
        </div>

        <!-- Tap readout + actions -->
        <div class="pm-tap-zone">
          <div class="pm-tap-readout">Tap Tempo</div>
          <div class="pm-action-row">
            <button class="pm-broadcast-btn pm-hidden">📡 Broadcast</button>
            <button class="pm-lock-btn pm-hidden">💾 Save to Song</button>
          </div>
          <button class="pm-countin-btn">Count In</button>
        </div>

        <!-- Tempo history graph -->
        <div class="pm-graph-section">
          <div class="pm-graph-label">Tempo History</div>
          <svg class="pm-history-graph" viewBox="0 0 280 50" preserveAspectRatio="none">
            <line class="pm-graph-target-line" x1="0" y1="25" x2="280" y2="25" stroke="#4ade80" stroke-width="0.5" stroke-dasharray="4 4" opacity="0.3"/>
            <polyline class="pm-graph-line" points="" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Drift report (shown after stop) -->
        <div class="pm-drift-report pm-hidden">
          <div class="pm-drift-title">Session Report</div>
          <div class="pm-drift-body"></div>
          <button class="pm-drift-close">Dismiss</button>
        </div>

        <!-- BPM save prompt (shown when user adjusts target BPM) -->
        <div class="pm-bpm-prompt pm-hidden">
          <div class="pm-bpm-prompt-msg">Save <span class="pm-bpm-prompt-val"></span> BPM to this song?</div>
          <div class="pm-bpm-prompt-btns">
            <button class="pm-bpm-save-yes">Save to Song</button>
            <button class="pm-bpm-save-no">Just for Now</button>
          </div>
        </div>

        <!-- Mini mode pill (only visible in mini mode) -->
        <div class="pm-mini-pill">
          <div class="pm-mini-bpm-val">—</div>
          <div class="pm-mini-status"></div>
          <div class="pm-mini-controls">
            <button class="pm-view-btn" data-view="full" title="Expand">↗</button>
          </div>
        </div>
      `;
      this.container.appendChild(div);
      this.el = div;
    }

    // ── Styles ─────────────────────────────────────────────────────────────────

    _injectStyles() {
      if (document.getElementById('pm-styles')) return;
      const s = document.createElement('style');
      s.id = 'pm-styles';
      s.textContent = `
        /* ── Root ──────────────────────────────────────────────────────────── */
        .pm-root {
          --pm-bg:        #0f0f1a;
          --pm-surface:   #1a1a2e;
          --pm-border:    #2a2a3e;
          --pm-green:     #4ade80;
          --pm-yellow:    #fbbf24;
          --pm-red:       #f87171;
          --pm-blue:      #818cf8;
          --pm-text:      #e2e8f0;
          --pm-muted:     #64748b;
          --pm-radius:    12px;
          --pm-font:      system-ui, -apple-system, sans-serif;

          background: var(--pm-bg);
          border: 1px solid var(--pm-border);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          position: relative;
          font-family: var(--pm-font);
          color: var(--pm-text);
          max-width: 360px;
          width: 100%;
          margin: 0 auto;
          /* Scrollable so it never overflows the page */
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .pm-root::-webkit-scrollbar { width: 4px; }
        .pm-root::-webkit-scrollbar-track { background: transparent; }
        .pm-root::-webkit-scrollbar-thumb { background: var(--pm-border); border-radius: 2px; }

        .pm-mode-gig { max-width: 420px; --pm-bg: #080812; }

        /* ── Banner ─────────────────────────────────────────────────────────── */
        .pm-banner {
          position: absolute; top: 0; left: 0; right: 0;
          background: #1a2e1a; color: var(--pm-green);
          font-size: 11px; text-align: center; padding: 7px 12px;
          transform: translateY(-100%); transition: transform 0.2s ease;
          z-index: 10; border-radius: 16px 16px 0 0;
          border-bottom: 1px solid #2a3e2a;
        }
        .pm-banner--show { transform: translateY(0); }
        .pm-flash-overlay { position: absolute; inset: 0; border-radius: 16px; pointer-events: none; z-index: 10; opacity: 0; transition: opacity 0.05s; }

        /* ── Header ─────────────────────────────────────────────────────────── */
        .pm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2px;
        }
        .pm-header-left { display: flex; align-items: baseline; gap: 6px; }
        .pm-header-label { font-size: 10px; color: var(--pm-muted); letter-spacing: 0.1em; text-transform: uppercase; }
        .pm-target-row { display: flex; align-items: center; gap: 4px; }
        .pm-target-bpm {
          font-size: 32px; font-weight: 700; color: var(--pm-text);
          letter-spacing: -0.03em; min-width: 56px; text-align: center; line-height: 1;
        }
        .pm-mode-gig .pm-target-bpm { font-size: 40px; }
        .pm-bpm-adj {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          color: var(--pm-text); font-size: 16px; font-weight: 300;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; line-height: 1; padding: 0;
        }
        .pm-bpm-adj:hover { background: var(--pm-border); border-color: var(--pm-blue); color: var(--pm-blue); }
        .pm-bpm-adj:active { transform: scale(0.92); }
        .pm-header-right { display: flex; align-items: center; gap: 6px; }
        .pm-settings-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          color: var(--pm-muted); font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .pm-settings-btn:hover { color: var(--pm-text); border-color: var(--pm-blue); }
        .pm-settings-btn.pm-active { color: var(--pm-blue); border-color: var(--pm-blue); background: rgba(129,140,248,0.1); }

        /* ── Toolbar ────────────────────────────────────────────────────────── */
        .pm-toolbar {
          display: flex; align-items: center; gap: 4px;
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          border-radius: 10px; padding: 5px 8px; flex-wrap: wrap;
        }
        .pm-mult-btn, .pm-sig-btn {
          background: transparent; border: 1px solid transparent;
          color: var(--pm-muted); font-family: var(--pm-font); font-size: 11px;
          font-weight: 500; padding: 3px 8px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.02em;
        }
        .pm-mult-btn:hover, .pm-sig-btn:hover { color: var(--pm-text); background: var(--pm-border); }
        .pm-mult--active, .pm-sig--active {
          background: rgba(129,140,248,0.15) !important;
          border-color: var(--pm-blue) !important; color: var(--pm-blue) !important;
        }
        .pm-toolbar-divider { width: 1px; height: 14px; background: var(--pm-border); margin: 0 2px; }
        .pm-flash-btn {
          background: transparent; border: 1px solid transparent;
          font-size: 13px; padding: 3px 5px; border-radius: 6px;
          cursor: pointer; opacity: 0.4; transition: all 0.15s;
        }
        .pm-flash-btn:hover { opacity: 0.8; }
        .pm-flash-btn--active { opacity: 1 !important; border-color: var(--pm-yellow) !important; }
        .pm-view-btn {
          background: transparent; border: 1px solid transparent;
          color: var(--pm-muted); font-size: 13px; padding: 3px 5px;
          border-radius: 6px; cursor: pointer; transition: all 0.15s;
        }
        .pm-view-btn:hover { color: var(--pm-text); background: var(--pm-border); }

        /* ── Settings panel ─────────────────────────────────────────────────── */
        .pm-settings-panel {
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          border-radius: 10px; padding: 12px 14px;
        }
        .pm-settings-title { font-size: 11px; font-weight: 600; color: var(--pm-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .pm-settings-row { margin-bottom: 10px; }
        .pm-settings-label { display: block; font-size: 11px; color: var(--pm-muted); font-weight: 500; margin-bottom: 5px; }
        .pm-settings-track { display: flex; align-items: center; gap: 8px; }
        .pm-settings-hint { font-size: 10px; color: var(--pm-muted); min-width: 38px; }
        .pm-settings-track input[type=range] {
          flex: 1; -webkit-appearance: none; height: 4px;
          background: var(--pm-border); border-radius: 2px; outline: none;
        }
        .pm-settings-track input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
          background: var(--pm-blue); cursor: pointer;
          box-shadow: 0 0 0 3px rgba(129,140,248,0.25);
        }
        .pm-settings-desc { font-size: 10px; color: #3a3a5e; margin-top: 4px; line-height: 1.4; }

        /* ── Gauge ──────────────────────────────────────────────────────────── */
        .pm-gauge-wrap {
          position: relative; width: 100%; max-width: 260px;
          margin: 0 auto;
        }
        .pm-mode-gig .pm-gauge-wrap { max-width: 300px; }
        .pm-gauge-arc { width: 100%; height: auto; display: block; overflow: visible; }

        /* Needle pegged: shimmer red */
        .pm-needle--pegged line { stroke: var(--pm-red) !important; animation: pm-peg-pulse 0.4s ease-in-out infinite alternate; }
        .pm-needle--pegged circle { fill: var(--pm-red) !important; }
        @keyframes pm-peg-pulse { from { opacity: 1; } to { opacity: 0.3; } }

        /* Pulse ring (gig mode) */
        .pm-pulse-ring { position: absolute; inset: -8px; border-radius: 50%; border: 2px solid transparent; pointer-events: none; }
        @keyframes pm-pulse { 0% { opacity: 0.8; transform: scale(0.97); } 100% { opacity: 0; transform: scale(1.06); } }
        .pm-pulse-anim { animation: pm-pulse 0.35s ease-out forwards; }

        /* Center readout */
        .pm-center-readout {
          position: absolute; bottom: 10px; left: 50%;
          transform: translateX(-50%);
          text-align: center; line-height: 1; pointer-events: none;
          width: 100%;
        }
        .pm-live-label { font-size: 9px; letter-spacing: 0.12em; color: var(--pm-muted); text-transform: uppercase; margin-bottom: 2px; }
        .pm-live-bpm { font-size: 40px; font-weight: 700; color: var(--pm-text); letter-spacing: -0.04em; }
        .pm-mode-gig .pm-live-bpm { font-size: 52px; }
        .pm-delta { font-size: 13px; font-weight: 600; letter-spacing: 0.03em; margin-top: 2px; }
        .pm-delta--green   { color: var(--pm-green); }
        .pm-delta--yellow  { color: var(--pm-yellow); }
        .pm-delta--red     { color: var(--pm-red); }
        .pm-delta--neutral { color: var(--pm-muted); }

        /* ── Status label ───────────────────────────────────────────────────── */
        .pm-status-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.2em;
          text-align: center; text-transform: uppercase; min-height: 1.4em;
          transition: color 0.3s;
        }
        .pm-mode-gig .pm-status-label { font-size: 15px; }
        .pm-status--green  { color: var(--pm-green); }
        .pm-status--yellow { color: var(--pm-yellow); }
        .pm-status--red    { color: var(--pm-red); }
        .pm-status--neutral { color: var(--pm-muted); }

        /* ── Controls ───────────────────────────────────────────────────────── */
        .pm-controls { display: flex; gap: 8px; }
        .pm-controls button {
          flex: 1; padding: 10px 8px; border-radius: 10px;
          font-family: var(--pm-font); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.02em;
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          color: var(--pm-text);
        }
        .pm-controls button:hover { border-color: var(--pm-blue); color: var(--pm-blue); background: rgba(129,140,248,0.08); }
        .pm-controls button:active { transform: scale(0.97); }
        .pm-listen-btn.pm-listen--active { border-color: var(--pm-red) !important; color: var(--pm-red) !important; background: rgba(248,113,113,0.08) !important; }
        .pm-tap-btn { touch-action: manipulation; }
        @keyframes pm-tap-f { 0% { background: rgba(74,222,128,0.15); } 100% { background: var(--pm-surface); } }
        .pm-tap-flash { animation: pm-tap-f 0.12s ease-out forwards; }

        /* ── Tap zone ───────────────────────────────────────────────────────── */
        .pm-tap-zone { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .pm-tap-readout { font-size: 20px; font-weight: 700; color: var(--pm-yellow); min-height: 1.4em; text-align: center; letter-spacing: -0.01em; }
        .pm-mode-gig .pm-tap-readout { font-size: 26px; }
        .pm-action-row { display: flex; gap: 6px; width: 100%; }
        .pm-action-row button {
          flex: 1; padding: 9px 8px; border-radius: 10px;
          font-family: var(--pm-font); font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .pm-action-row button:active { transform: scale(0.97); }
        .pm-broadcast-btn { background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.3); color: var(--pm-green); }
        .pm-broadcast-btn:hover { background: rgba(74,222,128,0.15); }
        .pm-lock-btn { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3); color: var(--pm-yellow); }
        .pm-lock-btn:hover { background: rgba(251,191,36,0.15); }
        .pm-hidden { display: none !important; }
        .pm-countin-btn {
          width: 100%; padding: 9px; border-radius: 10px;
          background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.2);
          color: var(--pm-green); font-family: var(--pm-font); font-size: 12px;
          font-weight: 600; letter-spacing: 0.05em; cursor: pointer; transition: all 0.2s;
        }
        .pm-countin-btn:hover { background: rgba(74,222,128,0.12); border-color: var(--pm-green); }

        /* ── Graph ──────────────────────────────────────────────────────────── */
        .pm-graph-section {
          background: var(--pm-surface); border: 1px solid var(--pm-border);
          border-radius: 10px; padding: 8px 10px;
        }
        .pm-graph-label { font-size: 10px; color: var(--pm-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
        .pm-history-graph { width: 100%; height: 50px; display: block; }

        /* ── Drift report ───────────────────────────────────────────────────── */
        .pm-drift-report {
          background: var(--pm-surface); border: 1px solid rgba(74,222,128,0.2);
          border-radius: 10px; padding: 12px 14px;
        }
        .pm-drift-title { font-size: 11px; font-weight: 700; color: var(--pm-green); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
        .pm-drift-stat { font-size: 12px; color: var(--pm-muted); padding: 4px 0; border-bottom: 1px solid var(--pm-border); display: flex; justify-content: space-between; }
        .pm-drift-stat span { color: var(--pm-text); font-weight: 600; }
        .pm-drift-close {
          width: 100%; margin-top: 8px; padding: 7px; border-radius: 8px;
          background: transparent; border: 1px solid var(--pm-border);
          color: var(--pm-muted); font-family: var(--pm-font); font-size: 11px;
          cursor: pointer; transition: all 0.15s;
        }
        .pm-drift-close:hover { color: var(--pm-text); border-color: var(--pm-text); }

        /* ── Source selector ────────────────────────────────────────────── */
        .pm-source-bar {
          display: flex; gap: 4px; margin-bottom: 8px;
        }
        .pm-src-btn {
          flex: 1; padding: 6px 4px; font-size: 10px; font-weight: 600;
          letter-spacing: 0.04em; border-radius: 6px; cursor: pointer;
          border: 1px solid var(--pm-border); background: rgba(255,255,255,0.03);
          color: var(--pm-muted); transition: all 0.15s; white-space: nowrap;
        }
        .pm-src-btn.pm-src--active {
          background: rgba(129,140,248,0.15); border-color: var(--pm-blue);
          color: var(--pm-blue);
        }

        /* ── File controls ──────────────────────────────────────────────── */
        .pm-controls--file {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 10px 0;
        }
        .pm-file-label {
          width: 100%; padding: 10px 14px; border: 1px dashed var(--pm-border);
          border-radius: 8px; cursor: pointer; text-align: center;
          color: var(--pm-muted); font-size: 12px; transition: border-color 0.15s;
        }
        .pm-file-label:hover { border-color: var(--pm-blue); color: var(--pm-blue); }
        .pm-analyze-btn {
          width: 100%; padding: 10px; font-size: 13px; font-weight: 700;
          letter-spacing: 0.05em; border-radius: 8px; cursor: pointer;
          border: 1px solid var(--pm-blue); background: rgba(129,140,248,0.12);
          color: var(--pm-blue); transition: all 0.15s;
        }
        .pm-analyze-btn:hover:not(:disabled) { background: rgba(129,140,248,0.25); }
        .pm-analyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Progress bar ───────────────────────────────────────────────── */
        .pm-progress-wrap { padding: 8px 0; }
        .pm-progress-bar {
          height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px;
          overflow: hidden; margin-bottom: 6px;
        }
        .pm-progress-fill {
          height: 100%; background: var(--pm-blue); border-radius: 2px;
          transition: width 0.3s ease;
        }
        .pm-progress-label {
          font-size: 10px; color: var(--pm-muted); text-align: center;
          letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* ── BPM save prompt ─────────────────────────────────────────────────── */
        .pm-bpm-prompt {
          background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.25);
          border-radius: 10px; padding: 10px 12px;
        }
        .pm-bpm-prompt-msg { font-size: 12px; color: var(--pm-yellow); font-weight: 600; margin-bottom: 8px; text-align: center; }
        .pm-bpm-prompt-btns { display: flex; gap: 6px; }
        .pm-bpm-prompt-btns button {
          flex: 1; padding: 7px; border-radius: 8px; cursor: pointer;
          font-family: var(--pm-font); font-size: 11px; font-weight: 600;
          transition: all 0.15s;
        }
        .pm-bpm-save-yes { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.4); color: var(--pm-yellow); }
        .pm-bpm-save-yes:hover { background: rgba(251,191,36,0.25); }
        .pm-bpm-save-no { background: transparent; border: 1px solid var(--pm-border); color: var(--pm-muted); }
        .pm-bpm-save-no:hover { color: var(--pm-text); }

        /* ── Mini pill ──────────────────────────────────────────────────────── */
        .pm-mini-pill { display: none; }
        .pm-root.pm-mini {
          position: fixed; bottom: 90px; right: 16px; z-index: 9999;
          width: auto; max-width: none; max-height: none; overflow: visible;
          padding: 8px 12px; border-radius: 40px; cursor: move;
          flex-direction: row; align-items: center; gap: 8px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,222,128,0.15);
          background: rgba(15,15,26,0.95); backdrop-filter: blur(12px);
        }
        /* In mini mode: hide everything except the mini pill */
        .pm-root.pm-mini > *:not(.pm-mini-pill) { display: none !important; }
        .pm-root.pm-mini .pm-mini-pill {
          display: flex; align-items: center; gap: 8px;
        }
        .pm-mini-bpm-val { font-size: 24px; font-weight: 700; color: var(--pm-text); letter-spacing: -0.03em; line-height: 1; white-space: nowrap; min-width: 52px; }
        .pm-mini-status { font-size: 9px; font-weight: 700; color: var(--pm-muted); letter-spacing: 0.1em; text-transform: uppercase; }
        .pm-mini-controls button { width: 26px; height: 26px; border-radius: 50%; background: var(--pm-surface); border: 1px solid var(--pm-border); color: var(--pm-muted); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; padding: 0; }
        .pm-mini-controls button:hover { color: var(--pm-text); border-color: var(--pm-blue); }

        /* ── Float mode ─────────────────────────────────────────────────────── */
        .pm-root.pm-float {
          position: fixed; bottom: 90px; right: 16px; z-index: 9999;
          width: min(320px, 92vw); cursor: move;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(74,222,128,0.1);
          backdrop-filter: blur(12px); max-height: calc(100vh - 120px);
        }
        .pm-root.pm-float .pm-graph-section,
        .pm-root.pm-float .pm-drift-report,
        .pm-root.pm-float .pm-settings-panel { display: none !important; }
      `;
      document.head.appendChild(s);
    }
  }

  // Export
  global.PocketMeter = PocketMeter;

})(window);
