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

      // Rolling window + range filter (v2 upgrade)
      this._rollingWindow = 16;  // beats for rolling BPM calculation
      this._bpmMin = 40;         // user-settable min BPM
      this._bpmMax = 220;        // user-settable max BPM
      this._stabilityHistory = []; // recent BPM values for stability calc
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

      // ── Spectral flux per band (v2: enhanced weighting) ──────────────────
      // Kick+snare prioritized, hi-hat/ride de-emphasized
      const kickFlux  = this._bandFlux(mag, bin(50),   bin(200),  0.55);  // kick
      const snareFlux = this._bandFlux(mag, bin(200),  bin(1000), 0.30);  // snare body
      const hatFlux   = this._bandFlux(mag, bin(3000), bin(8000), 0.15);  // hi-hat/ride (de-emphasized)
      const flux      = kickFlux + snareFlux + hatFlux;

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
          // Guided mode subscriber — gets raw onset timestamps for phase-lock.
          if (typeof this.onOnset === 'function') this.onOnset(now);
        }
      }

      this._prevMag = mag;
    }

    /** v2: Calculate tempo stability score (0-100%) from recent BPM values */
    getStabilityScore() {
      if (this._stabilityHistory.length < 4) return null;
      const n = this._stabilityHistory.length;
      const mean = this._stabilityHistory.reduce((a, b) => a + b, 0) / n;
      const variance = this._stabilityHistory.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);
      // 0 BPM variance = 100%, 5+ BPM variance = 0%
      return Math.round(Math.max(0, Math.min(100, 100 - (stdDev / 5) * 100)));
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

      // Use rolling window of last N onsets (v2: configurable, default 16)
      const windowOnsets = this.onsets.slice(-this._rollingWindow);
      if (windowOnsets.length < 4) return;

      // Inter-onset intervals within the window
      const iois = [];
      for (let i = 1; i < windowOnsets.length; i++) {
        iois.push(windowOnsets[i] - windowOnsets[i - 1]);
      }

      // Median filter (robust to occasional double-triggers)
      const sorted = [...iois].sort((a, b) => a - b);
      const med    = sorted[Math.floor(sorted.length / 2)];

      // v2: user-settable BPM range filter
      const minIOI = 60000 / this._bpmMax;  // fastest allowed beat
      const maxIOI = 60000 / this._bpmMin;  // slowest allowed beat
      if (med < minIOI || med > maxIOI) return;

      const rawBPM = 60000 / med;

      if (this.smoothedBPM === null) {
        this.smoothedBPM = rawBPM;
      } else {
        const alpha = this._smoothing || 0.5;
        this.smoothedBPM = this.smoothedBPM * (1 - alpha) + rawBPM * alpha;
      }

      // v2: track stability — variance of recent BPM values
      this._stabilityHistory.push(this.smoothedBPM);
      if (this._stabilityHistory.length > 16) this._stabilityHistory.shift();

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

    /** v2: Section analysis — split onsets into chunks and analyze each */
    analyseSections(onsets, targetBPM, sectionCount) {
      if (!onsets || onsets.length < 16) return [];
      sectionCount = sectionCount || 4;
      const chunkSize = Math.floor(onsets.length / sectionCount);
      const sections = [];
      const labels = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Outro'];
      for (var s = 0; s < sectionCount; s++) {
        var start = s * chunkSize;
        var end = s === sectionCount - 1 ? onsets.length : (s + 1) * chunkSize;
        var chunk = onsets.slice(start, end);
        var result = this.analyse(chunk, targetBPM);
        if (result) {
          var direction = result.pocketPositionMs < -5 ? 'rushing' : result.pocketPositionMs > 5 ? 'dragging' : 'stable';
          sections.push({
            label: labels[s] || 'Section ' + (s + 1),
            stabilityScore: result.stabilityScore,
            pocketPositionMs: result.pocketPositionMs,
            direction: direction,
            pctInPocket: result.pctInPocket,
          });
        }
      }
      return sections;
    },
  };

  // ─── BPM Time Series ────────────────────────────────────────────────────────
  // Derives windowed BPM values from pre-computed IOIs (no re-analysis needed).
  // Used by the Pocket Meter graph in the timeline.

  const PocketMeterTimeSeries = {
    /**
     * Compute BPM at sliding windows across a segment's IOIs.
     * @param {object} groove - seg.groove object with iois, medianIOI, targetBeatMs
     * @param {number} startSec - segment start time in seconds
     * @param {number} targetBPM - song's target BPM
     * @param {number} [windowBeats=8] - number of beats per window
     * @returns {{ points: Array<{timeSec, bpm, deviation}>, avgBPM, variance, stability,
     *             rushing, dragging, problemZones: Array<{startSec, endSec, avgBPM, type}> }}
     */
    compute(groove, startSec, targetBPM, windowBeats) {
      if (!groove || !groove.iois || groove.iois.length < 4) return null;
      windowBeats = windowBeats || 8;

      var iois = groove.iois;
      var targetBeatMs = 60000 / targetBPM;
      var points = [];
      var cumulativeMs = 0;

      // Slide window across IOIs
      for (var i = 0; i <= iois.length - windowBeats; i++) {
        var windowSum = 0;
        for (var j = i; j < i + windowBeats; j++) windowSum += iois[j];
        var avgIOI = windowSum / windowBeats;
        var bpm = 60000 / avgIOI;
        var deviation = bpm - targetBPM;

        // Time position: center of window
        var windowStartMs = 0;
        for (var k = 0; k < i; k++) windowStartMs += iois[k];
        var windowCenterMs = windowStartMs + (windowSum / 2);
        var timeSec = startSec + (windowCenterMs / 1000);

        points.push({ timeSec: Math.round(timeSec * 10) / 10, bpm: Math.round(bpm * 10) / 10, deviation: Math.round(deviation * 10) / 10 });
      }

      if (points.length === 0) return null;

      // Aggregate metrics
      var bpms = points.map(function(p) { return p.bpm; });
      var avgBPM = Math.round(bpms.reduce(function(a, b) { return a + b; }, 0) / bpms.length * 10) / 10;
      var variance = 0;
      for (var v = 0; v < bpms.length; v++) variance += Math.pow(bpms[v] - avgBPM, 2);
      variance = Math.round(Math.sqrt(variance / bpms.length) * 10) / 10;
      var stability = Math.round(Math.max(0, 100 - (variance / 5) * 100));
      var avgDeviation = avgBPM - targetBPM;
      var rushing = avgDeviation > 2;
      var dragging = avgDeviation < -2;

      // Detect problem zones: consecutive windows with deviation > threshold
      var threshold = Math.max(3, targetBPM * 0.03); // 3% of target BPM or 3 BPM, whichever is larger
      var problemZones = [];
      var zoneStart = null;
      var zoneBPMs = [];
      for (var z = 0; z < points.length; z++) {
        var absDev = Math.abs(points[z].deviation);
        if (absDev > threshold) {
          if (zoneStart === null) { zoneStart = z; zoneBPMs = []; }
          zoneBPMs.push(points[z].bpm);
        } else {
          if (zoneStart !== null && (z - zoneStart) >= 2) {
            var zAvg = zoneBPMs.reduce(function(a, b) { return a + b; }, 0) / zoneBPMs.length;
            problemZones.push({
              startSec: points[zoneStart].timeSec,
              endSec: points[z - 1].timeSec,
              avgBPM: Math.round(zAvg * 10) / 10,
              type: zAvg > targetBPM ? 'rushing' : 'dragging'
            });
          }
          zoneStart = null;
        }
      }
      // Close trailing zone
      if (zoneStart !== null && (points.length - zoneStart) >= 2) {
        var zAvg2 = zoneBPMs.reduce(function(a, b) { return a + b; }, 0) / zoneBPMs.length;
        problemZones.push({
          startSec: points[zoneStart].timeSec,
          endSec: points[points.length - 1].timeSec,
          avgBPM: Math.round(zAvg2 * 10) / 10,
          type: zAvg2 > targetBPM ? 'rushing' : 'dragging'
        });
      }

      // Stability category
      var stabilityLabel = stability >= 90 ? 'Locked in' : stability >= 75 ? 'Solid' : stability >= 60 ? 'Drifting' : 'Unstable';
      var stabilityColor = stability >= 90 ? '#10b981' : stability >= 75 ? '#22c55e' : stability >= 60 ? '#f59e0b' : '#ef4444';

      // Musician-friendly direction label
      var directionLabel = '';
      if (Math.abs(avgDeviation) <= 2) directionLabel = 'Steady';
      else if (rushing) directionLabel = 'Speeding up (+' + Math.abs(Math.round(avgDeviation * 10) / 10) + ' BPM)';
      else directionLabel = 'Slowing down (' + Math.round(avgDeviation * 10) / 10 + ' BPM)';

      // Rank problem zones by severity (duration × deviation)
      problemZones.forEach(function(z) {
        z.durationSec = z.endSec - z.startSec;
        z.severity = z.durationSec * Math.abs(z.avgBPM - targetBPM);
        z.label = z.avgBPM > targetBPM
          ? 'Speeding up (+' + Math.round(Math.abs(z.avgBPM - targetBPM)) + ' BPM)'
          : 'Slowing down (-' + Math.round(Math.abs(z.avgBPM - targetBPM)) + ' BPM)';
      });
      problemZones.sort(function(a, b) { return b.severity - a.severity; });
      var worstZone = problemZones.length > 0 ? problemZones[0] : null;

      // Generate coaching insights from pattern analysis
      var coachingInsights = [];
      if (points.length >= 6) {
        // Check if tempo rises toward the end (common: speeding up in choruses/endings)
        var firstHalf = points.slice(0, Math.floor(points.length / 2));
        var secondHalf = points.slice(Math.floor(points.length / 2));
        var avgFirst = firstHalf.reduce(function(a, p) { return a + p.bpm; }, 0) / firstHalf.length;
        var avgSecond = secondHalf.reduce(function(a, p) { return a + p.bpm; }, 0) / secondHalf.length;
        var halfDelta = avgSecond - avgFirst;
        if (halfDelta > 3) coachingInsights.push('Tempo speeds up toward the end');
        else if (halfDelta < -3) coachingInsights.push('Tempo drags toward the end');

        // Check for a sudden jump (transition breakdown)
        for (var ci = 1; ci < points.length; ci++) {
          if (Math.abs(points[ci].bpm - points[ci - 1].bpm) > targetBPM * 0.08) {
            coachingInsights.push('Timing breaks at ' + _fmtSec(points[ci].timeSec) + ' \u2014 possible transition issue');
            break; // only report the first big jump
          }
        }
      }
      if (variance > 3 && !coachingInsights.length) coachingInsights.push('Tempo wanders \u2014 try a click track');
      // Cap to 2 insights max
      if (coachingInsights.length > 2) coachingInsights = coachingInsights.slice(0, 2);

      // Headline takeaway — short, scannable, actionable
      var headline = '';
      if (stability >= 90 && Math.abs(avgDeviation) <= 2) {
        headline = 'Right in the pocket';
      } else if (stability >= 75 && Math.abs(avgDeviation) <= 2) {
        headline = 'Solid \u2014 minor drift';
      } else if (worstZone) {
        var wzDir = worstZone.type === 'rushing' ? 'Sped up' : 'Slowed down';
        var _segDur = points[points.length - 1].timeSec - points[0].timeSec;
        var wzWhen = worstZone.startSec < (points[0].timeSec + _segDur * 0.3)
          ? 'early' : worstZone.endSec > (points[0].timeSec + _segDur * 0.7)
          ? 'late' : 'mid-song';
        var hasTransition = coachingInsights.some(function(c) { return c.match(/transition/i); });
        headline = wzDir + ' ' + wzWhen + (hasTransition ? ' \u2014 transition issue' : ' \u2014 start here');
      } else if (rushing) {
        headline = 'Running hot \u2014 ease back';
      } else if (dragging) {
        headline = 'Dragging \u2014 push the energy';
      } else {
        headline = 'Decent \u2014 keep tightening';
      }

      return {
        points: points,
        avgBPM: avgBPM,
        variance: variance,
        stability: stability,
        stabilityLabel: stabilityLabel,
        stabilityColor: stabilityColor,
        rushing: rushing,
        dragging: dragging,
        deviation: Math.round(avgDeviation * 10) / 10,
        directionLabel: directionLabel,
        targetBPM: targetBPM,
        problemZones: problemZones,
        worstZone: worstZone,
        coachingInsights: coachingInsights,
        headline: headline,
        // Cross-session comparison fingerprint (for future session-vs-session comparison)
        // Contains the minimum data needed to compare this segment's groove profile
        // against the same song in a previous rehearsal session.
        fingerprint: {
          songTitle: null, // set by caller — compute() doesn't know the song
          avgBPM: avgBPM,
          variance: variance,
          stability: stability,
          deviation: Math.round(avgDeviation * 10) / 10,
          problemZoneCount: problemZones.length,
          worstSeverity: worstZone ? Math.round(worstZone.severity * 10) / 10 : 0,
          pointCount: points.length,
          timestamp: null // set by caller — when this session occurred
        }
      };
    },

    /**
     * Generate SVG line chart for BPM time series.
     * @param {object} ts - output of compute()
     * @param {number} width - chart width in px
     * @param {number} height - chart height in px
     * @returns {string} SVG markup
     */
    renderSVG(ts, width, height) {
      if (!ts || !ts.points.length) return '';
      width = width || 300;
      height = height || 80;
      var pad = { top: 8, right: 8, bottom: 16, left: 32 };
      var w = width - pad.left - pad.right;
      var h = height - pad.top - pad.bottom;

      var minTime = ts.points[0].timeSec;
      var maxTime = ts.points[ts.points.length - 1].timeSec;
      var timeRange = maxTime - minTime || 1;

      // BPM range: center on target, expand to fit data
      var bpms = ts.points.map(function(p) { return p.bpm; });
      var minBPM = Math.min.apply(null, bpms.concat([ts.targetBPM - 5]));
      var maxBPM = Math.max.apply(null, bpms.concat([ts.targetBPM + 5]));
      var bpmRange = maxBPM - minBPM || 10;

      function x(timeSec) { return pad.left + ((timeSec - minTime) / timeRange) * w; }
      function y(bpm) { return pad.top + h - ((bpm - minBPM) / bpmRange) * h; }

      var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block">';

      // Acceptable range band (±3% of target, shaded green)
      var bandWidth = Math.max(3, ts.targetBPM * 0.03);
      var bandTop = y(ts.targetBPM + bandWidth);
      var bandBot = y(ts.targetBPM - bandWidth);
      svg += '<rect x="' + pad.left + '" y="' + bandTop + '" width="' + w + '" height="' + Math.max(1, bandBot - bandTop) + '" fill="rgba(16,185,129,0.06)" rx="1"/>';

      // Problem zone highlights — worst zone gets pulse animation class
      ts.problemZones.forEach(function(z, zi) {
        var zx1 = x(z.startSec);
        var zx2 = x(z.endSec);
        var isWorst = ts.worstZone && z === ts.worstZone;
        var color = z.type === 'rushing' ? (isWorst ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)') : (isWorst ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)');
        svg += '<rect x="' + zx1 + '" y="' + pad.top + '" width="' + Math.max(2, zx2 - zx1) + '" height="' + h + '" fill="' + color + '" rx="2"'
          + (isWorst ? ' class="rh-zone-pulse"' : '') + '/>';
      });

      // Target BPM reference line
      var ty = y(ts.targetBPM);
      svg += '<line x1="' + pad.left + '" y1="' + ty + '" x2="' + (width - pad.right) + '" y2="' + ty + '" stroke="#334155" stroke-width="1" stroke-dasharray="4,3"/>';
      svg += '<text x="' + (pad.left - 2) + '" y="' + (ty + 3) + '" fill="#475569" font-size="8" text-anchor="end">' + ts.targetBPM + '</text>';

      // BPM curve
      var pathD = '';
      ts.points.forEach(function(p, i) {
        var px = x(p.timeSec);
        var py = y(p.bpm);
        pathD += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1);
      });
      // Gradient: green when near target, shifts to amber/red on deviation
      svg += '<path d="' + pathD + '" fill="none" stroke="#667eea" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>';

      // Clickable problem zone markers — worst zone gets larger marker
      ts.problemZones.forEach(function(z, zi) {
        var zx = x((z.startSec + z.endSec) / 2);
        var zy = pad.top + 4;
        var isWorst = ts.worstZone && z === ts.worstZone;
        var markerColor = z.type === 'rushing' ? '#ef4444' : '#f59e0b';
        var label = z.type === 'rushing' ? '\u2191' : '\u2193';
        var r = isWorst ? 7 : 5;
        svg += '<circle cx="' + zx + '" cy="' + zy + '" r="' + r + '" fill="' + markerColor + '" opacity="' + (isWorst ? '1' : '0.7') + '" style="cursor:pointer" '
          + 'onclick="_rhJumpToTime(' + z.startSec.toFixed(1) + ')" />';
        svg += '<text x="' + zx + '" y="' + (zy + 3) + '" fill="white" font-size="' + (isWorst ? '8' : '7') + '" text-anchor="middle" style="pointer-events:none">' + label + '</text>';
      });

      // Y-axis labels
      svg += '<text x="' + (pad.left - 2) + '" y="' + (pad.top + 6) + '" fill="#475569" font-size="7" text-anchor="end">' + Math.round(maxBPM) + '</text>';
      svg += '<text x="' + (pad.left - 2) + '" y="' + (height - pad.bottom + 2) + '" fill="#475569" font-size="7" text-anchor="end">' + Math.round(minBPM) + '</text>';

      // Time labels
      svg += '<text x="' + pad.left + '" y="' + (height - 2) + '" fill="#475569" font-size="7">' + _fmtSec(minTime) + '</text>';
      svg += '<text x="' + (width - pad.right) + '" y="' + (height - 2) + '" fill="#475569" font-size="7" text-anchor="end">' + _fmtSec(maxTime) + '</text>';

      svg += '</svg>';
      return svg;
    },

    /**
     * Render compare overlay: multiple BPM curves on one chart.
     * @param {Array<{ts: object, label: string, color: string}>} series
     * @param {number} width
     * @param {number} height
     * @returns {string} SVG markup
     */
    renderCompareSVG(series, width, height) {
      if (!series || !series.length) return '';
      width = width || 300;
      height = height || 100;
      var pad = { top: 8, right: 8, bottom: 20, left: 32 };
      var w = width - pad.left - pad.right;
      var h = height - pad.top - pad.bottom;
      var targetBPM = series[0].ts.targetBPM;

      // Find global ranges across all series
      var allBPMs = [];
      var maxDur = 0;
      series.forEach(function(s) {
        s.ts.points.forEach(function(p) { allBPMs.push(p.bpm); });
        var dur = s.ts.points[s.ts.points.length - 1].timeSec - s.ts.points[0].timeSec;
        if (dur > maxDur) maxDur = dur;
      });
      var minBPM = Math.min.apply(null, allBPMs.concat([targetBPM - 5]));
      var maxBPM = Math.max.apply(null, allBPMs.concat([targetBPM + 5]));
      var bpmRange = maxBPM - minBPM || 10;

      function x(relSec) { return pad.left + (relSec / (maxDur || 1)) * w; }
      function y(bpm) { return pad.top + h - ((bpm - minBPM) / bpmRange) * h; }

      var svg = '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="display:block">';

      // Acceptable range band
      var cBandW = Math.max(3, targetBPM * 0.03);
      var cBandTop = y(targetBPM + cBandW);
      var cBandBot = y(targetBPM - cBandW);
      svg += '<rect x="' + pad.left + '" y="' + cBandTop + '" width="' + w + '" height="' + Math.max(1, cBandBot - cBandTop) + '" fill="rgba(16,185,129,0.06)" rx="1"/>';

      // Target line
      var ty = y(targetBPM);
      svg += '<line x1="' + pad.left + '" y1="' + ty + '" x2="' + (width - pad.right) + '" y2="' + ty + '" stroke="#334155" stroke-width="1" stroke-dasharray="4,3"/>';
      svg += '<text x="' + (pad.left - 2) + '" y="' + (ty + 3) + '" fill="#475569" font-size="8" text-anchor="end">' + targetBPM + '</text>';

      // Render each series
      var colors = ['#667eea', '#f59e0b', '#10b981', '#ef4444'];
      series.forEach(function(s, si) {
        var startTime = s.ts.points[0].timeSec;
        var pathD = '';
        s.ts.points.forEach(function(p, i) {
          var px = x(p.timeSec - startTime);
          var py = y(p.bpm);
          pathD += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1);
        });
        var color = s.color || colors[si % colors.length];
        svg += '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" opacity="' + (si === 0 ? '1' : '0.6') + '"/>';
      });

      // Legend
      var legendY = height - 4;
      series.forEach(function(s, si) {
        var lx = pad.left + si * 80;
        var color = s.color || colors[si % colors.length];
        svg += '<circle cx="' + lx + '" cy="' + (legendY - 3) + '" r="3" fill="' + color + '"/>';
        svg += '<text x="' + (lx + 6) + '" y="' + legendY + '" fill="#94a3b8" font-size="7">' + (s.label || 'Take ' + (si + 1)) + '</text>';
      });

      svg += '</svg>';
      return svg;
    },

    /**
     * Compare current fingerprint against a previous one for the same song.
     * @param {object} current - fingerprint from current session
     * @param {object} previous - fingerprint from previous session
     * @returns {{ improved: boolean, label: string, varianceDelta: number, stabilityDelta: number }|null}
     */
    compareFingerprints(current, previous) {
      if (!current || !previous) return null;
      var vDelta = previous.variance - current.variance; // positive = tighter
      var sDelta = current.stability - previous.stability; // positive = steadier
      var label = '';
      var tier = 'same';
      var improved = false;

      // Primary: variance change (max 1 label + optional 1 clause)
      if (vDelta > 1.5) {
        tier = 'big_gain'; improved = true;
        label = 'Much tighter';
      } else if (vDelta > 0.5) {
        tier = 'gain'; improved = true;
        label = 'Tighter';
      } else if (vDelta < -1.5) {
        tier = 'big_slip';
        label = 'Looser \u2014 tighten it up';
      } else if (vDelta < -0.5) {
        tier = 'slip';
        label = 'Slightly looser \u2014 tighten it up';
      } else {
        tier = 'same';
        label = 'About the same';
      }

      // Optional supporting clause (max 1, stability-based)
      if (tier === 'same' && sDelta > 8) {
        tier = 'gain'; improved = true;
        label = 'Steadier timing';
      } else if (tier === 'same' && sDelta < -8) {
        tier = 'slip';
        label = 'Less steady \u2014 tighten it up';
      } else if ((tier === 'gain' || tier === 'big_gain') && sDelta > 5) {
        label += ' and steadier';
      }

      return {
        improved: improved,
        tier: tier,
        label: label,
        varianceDelta: Math.round(vDelta * 10) / 10,
        stabilityDelta: sDelta
      };
    },

    /**
     * Detect trend from fingerprint history (last 3+ entries).
     * @param {Array} history - array of fingerprint objects (oldest first)
     * @returns {{ trend: string, label: string }|null}
     */
    detectTrend(history) {
      if (!history || history.length < 3) return null;
      var recent = history.slice(-3);
      // Check if variance is consistently decreasing (tightening) or increasing (loosening)
      var tightening = 0;
      var loosening = 0;
      for (var i = 1; i < recent.length; i++) {
        var vDiff = recent[i - 1].variance - recent[i].variance;
        if (vDiff > 0.3) tightening++;
        else if (vDiff < -0.3) loosening++;
      }
      if (tightening >= 2) return { trend: 'improving', label: 'Trending tighter over recent rehearsals' };
      if (loosening >= 2) return { trend: 'slipping', label: 'Timing slipping over last few sessions' };
      return { trend: 'stable', label: null };
    }
  };

  function _fmtSec(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Export
  global.PocketMeterTimeSeries = PocketMeterTimeSeries;

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

    /**
     * Analyse an already-decoded AudioBuffer (avoids re-encoding for per-segment BPM).
     * Same algorithm as analyse() but skips the decodeAudioData step.
     * @param {AudioBuffer} audioBuffer — decoded audio
     * @param {number} targetBPM
     * @param {string} sourceType
     * @returns {Promise<{metrics, onsets, duration, sourceType}>}
     */
    async analyseBuffer(audioBuffer, targetBPM, sourceType) {
      const sr          = audioBuffer.sampleRate;
      const nChannels   = audioBuffer.numberOfChannels;
      const duration    = audioBuffer.duration;
      const FRAME_SIZE  = 2048;
      const HOP_SIZE    = 512;

      // Mix down to mono
      const mono = new Float32Array(audioBuffer.length);
      for (let ch = 0; ch < nChannels; ch++) {
        const chData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < mono.length; i++) mono[i] += chData[i] / nChannels;
      }

      // Spectral flux onset detection (same as analyse)
      const onsets      = [];
      const CHUNK_SECS  = 10;
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
        await new Promise(r => setTimeout(r, 0));
      }

      const metrics = GrooveAnalyser.analyse(onsets, targetBPM);
      return { metrics, onsets, duration, sourceType };
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

      // ── Guided Mode (v2) ──────────────────────────────────────────────────
      // Default on. User can fall back to the legacy auto-detect via the
      // Experimental toggle in the chooser. Everything legacy stays mounted
      // and functional; guided mode just lays an overlay on top when active.
      this._guided     = localStorage.getItem('pm_guided_mode') !== '0';
      this._lockedBPM  = null;           // null = chooser visible
      this._lockedAtMs = null;           // performance.now() at lock moment
      this._lastLabel  = null;           // label hysteresis (prev paint)
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    mount() {
      this._injectStyles();
      this._render();
      this._applySettings();
      this._bindEvents();
      this._bindSettingsUI();
      this._subscribeFirebase();
      // Safety: verify styles actually applied after render — force re-inject if missing
      var self = this;
      requestAnimationFrame(function() {
        if (self.el) {
          var root = self.el.querySelector('.pm-root') || self.el;
          var bg = getComputedStyle(root).backgroundColor;
          if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
            console.warn('[PocketMeter] Styles missing after mount — re-injecting');
            var stale = document.getElementById('pm-styles');
            if (stale) stale.remove();
            self._injectStyles();
          }
        }
      });
    }

    destroy() {
      this._stopListening();
      if (this._classifierInterval) { clearInterval(this._classifierInterval); this._classifierInterval = null; }
      if (this._visibilityHandler) {
        document.removeEventListener('visibilitychange', this._visibilityHandler);
        this._visibilityHandler = null;
      }
      if (this.fbRef) this.fbRef.off();
      if (this._pulseRaf) cancelAnimationFrame(this._pulseRaf);
      if (this.el) this.el.remove();
    }

    /** v2: Pocket Meter mode — 'live' or 'pocket' */
    _pmMode = 'live';

    _switchMode(newMode) {
      this._pmMode = newMode;
      if (!this.el) return;
      // Update toggle buttons
      this.el.querySelectorAll('.pm-mode-btn').forEach(function(btn) {
        var isActive = btn.dataset.pmmode === newMode;
        btn.style.background = isActive ? '#2a2a2a' : '#1a1a1a';
        btn.style.color = isActive ? '#a5b4fc' : '#64748b';
        btn.classList.toggle('pm-mode-btn--active', isActive);
      });
      // Update the main status label
      this._update();
    }

    setTargetBPM(bpm) {
      this.targetBPM = bpm;
      this._updateTarget();
      // Keep the guided chooser's "Use song BPM" value in sync.
      if (this._lockedBPM == null) this._renderGuidedState();
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

    // NOTE: This writes to /songs/{songKey}/bpm — a SEPARATE Firebase path from
    // the canonical song BPM at /assets/{title}/song_bpm. This is intentional:
    // Pocket Meter's "Lock" saves a live session consensus BPM that band members
    // can see in real time. The canonical song BPM (edited in Song DNA) lives in
    // the asset store and is managed by GLStore.updateSongField('bpm').
    // These two values may legitimately differ (e.g., song is 120 BPM but band
    // played it at 118 tonight).
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

      // v2: Stability score display
      var stabEl = this.el.querySelector('.pm-stability');
      if (!stabEl) {
        stabEl = document.createElement('div');
        stabEl.className = 'pm-stability';
        stabEl.style.cssText = 'text-align:center;font-size:0.72em;font-weight:700;padding:2px 0;color:#64748b';
        var gaugeParent = this.el.querySelector('.pm-gauge-wrap');
        if (gaugeParent) gaugeParent.parentElement.insertBefore(stabEl, gaugeParent.nextSibling);
      }
      if (this.engine) {
        var stab = this.engine.getStabilityScore();
        // v3: Run GrooveAnalyser on live onsets for microtiming
        var groove = null;
        if (this.engine.onsets && this.engine.onsets.length >= 8) {
          groove = GrooveAnalyser.analyse(this.engine.onsets, this.targetBPM);
        }

        var stabLines = [];
        if (stab !== null) {
          var stabColor = stab >= 80 ? '#22c55e' : stab >= 50 ? '#f59e0b' : '#ef4444';
          stabLines.push('<span style="color:' + stabColor + '">' + (this._pmMode === 'pocket' ? 'Pocket' : 'Stability') + ': ' + stab + '%</span>');
        }
        // v3: Microtiming deviation
        if (groove && groove.pocketPositionMs !== undefined) {
          var devMs = groove.pocketPositionMs;
          var absMs = Math.abs(devMs);
          var devColor = absMs <= 10 ? '#22c55e' : absMs <= 25 ? '#f59e0b' : '#ef4444';
          var devLabel = absMs <= 10 ? 'excellent' : absMs <= 25 ? 'good' : absMs <= 40 ? 'drift' : 'unstable';
          var devSign = devMs >= 0 ? '+' : '';
          stabLines.push('<span style="color:' + devColor + '">' + devSign + devMs.toFixed(1) + 'ms ' + (devMs > 3 ? 'behind' : devMs < -3 ? 'ahead' : 'centered') + ' <span style="font-size:0.8em;opacity:0.7">(' + devLabel + ')</span></span>');
        }
        // v3: Pocket score
        if (groove && groove.pctInPocket !== undefined && this._pmMode === 'pocket') {
          var pktColor = groove.pctInPocket >= 80 ? '#22c55e' : groove.pctInPocket >= 50 ? '#f59e0b' : '#ef4444';
          stabLines.push('<span style="color:' + pktColor + '">In pocket: ' + groove.pctInPocket + '%</span>');
        }
        // v4: Beat variance (raw IOI standard deviation in ms)
        if (groove && groove.spacingVarianceMsRaw !== undefined) {
          var varMs = groove.spacingVarianceMsRaw;
          var varColor = varMs <= 10 ? '#22c55e' : varMs <= 25 ? '#f59e0b' : '#ef4444';
          stabLines.push('<span style="color:' + varColor + '">Variance: ' + varMs + 'ms</span>');
        }
        // v4: Groove Score (composite: stability × pocket × (1 - normalized variance))
        if (stab !== null && groove && groove.pctInPocket !== undefined) {
          var grooveScore = Math.round((stab * 0.4) + (groove.pctInPocket * 0.4) + (Math.max(0, 100 - groove.spacingVarianceMsRaw * 2) * 0.2));
          grooveScore = Math.max(0, Math.min(100, grooveScore));
          var gsColor = grooveScore >= 80 ? '#22c55e' : grooveScore >= 50 ? '#f59e0b' : '#ef4444';
          stabLines.push('<span style="font-weight:800;color:' + gsColor + '">Groove: ' + grooveScore + '</span>');
        }
        stabEl.innerHTML = stabLines.join(' <span style="color:#333">·</span> ');
      }

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
      this._flashBanner(`💾 Session tempo locked: ${this.tapTarget} BPM`);
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
      // v2: Wire mode toggle + zoom + range controls
      var self = this;
      this.el._pmSwitchMode = function(m) { self._switchMode(m); };
      this.el._pmSetZoom = function(sec) {
        self._graphZoomSec = sec;
        self.el.querySelectorAll('.pm-zoom-btn').forEach(function(btn) {
          var isActive = parseInt(btn.dataset.zoom) === sec;
          btn.style.background = isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
          btn.style.color = isActive ? '#94a3b8' : '#64748b';
          btn.classList.toggle('pm-zoom--active', isActive);
        });
        self._updateGraph();
      };
      this.el._pmSetRange = function(min, max) {
        if (self.engine) { self.engine._bpmMin = min; self.engine._bpmMax = max; }
        if (typeof showToast === 'function') showToast('BPM range: ' + min + '–' + max);
      };
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
          else if (btn.classList.contains('pm-sig--7')) this._timeSig = 7;
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
            this._flashBanner('✅ Session tempo locked (' + this._pendingBPM + ' BPM)');
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

      // ── Help panel toggle ───────────────────────────────────────────────────
      this.el._pmShowHelp = () => {
        const hp = this.el.querySelector('.pm-help-panel');
        if (hp) hp.classList.toggle('pm-hidden');
      };
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
      const beats = this._timeSig === 6 ? 6 : this._timeSig === 3 ? 3 : this._timeSig === 7 ? 7 : 4;
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
      const color = delta <= 2 ? 'rgba(0,255,136,0.40)' : delta <= 5 ? 'rgba(255,204,0,0.35)' : 'rgba(255,59,59,0.35)';
      overlay.style.background = color;
      overlay.style.opacity = '1';
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => { if (overlay) overlay.style.opacity = '0'; }, 60);
    }

    // -- Tempo History Graph ---------------------------------------------------

    _graphZoomSec = 30; // default 30-second window

    _updateGraph() {
      const svg = this.el && this.el.querySelector('.pm-history-graph');
      if (!svg) return;
      if (!this._history.length) {
        const l = svg.querySelector('.pm-graph-line'); if (l) l.setAttribute('points', ''); return;
      }

      // v2: zoom window — only show last N seconds
      const zoomMs = this._graphZoomSec * 1000;
      const now = this._history[this._history.length - 1].t;
      const startT = Math.max(0, now - zoomMs);
      const visible = this._history.filter(p => p.t >= startT);
      if (!visible.length) return;

      // v2: moving average smoothing (8-point window)
      const MA_WINDOW = 8;
      const smoothed = visible.map(function(p, i, arr) {
        var start = Math.max(0, i - MA_WINDOW + 1);
        var window = arr.slice(start, i + 1);
        var avg = window.reduce(function(a, b) { return a + b.bpm; }, 0) / window.length;
        return { t: p.t, bpm: avg };
      });

      const W = 280, H = 60, pad = 4, target = this.targetBPM;
      const lo = target - 15, hi = target + 15;
      const tRange = Math.max(1, smoothed[smoothed.length - 1].t - smoothed[0].t);
      const t0 = smoothed[0].t;
      const xS = (W - pad*2) / tRange, yS = (H - pad*2) / (hi - lo);

      const pts = smoothed.map(p => {
        const x = pad + (p.t - t0) * xS;
        const y = H - pad - (Math.min(hi, Math.max(lo, p.bpm)) - lo) * yS;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');

      // Target line
      const ty = (H - pad - (target - lo) * yS).toFixed(1);
      const tl = svg.querySelector('.pm-graph-target-line');
      if (tl) { tl.setAttribute('y1', ty); tl.setAttribute('y2', ty); }

      // Color by average drift
      const bpms = smoothed.map(p => p.bpm);
      const avgDrift = bpms.reduce((a,b) => a + Math.abs(b-target), 0) / bpms.length;
      const col = avgDrift <= 2 ? '#00ff88' : avgDrift <= 5 ? '#ffcc00' : '#ff4444';
      const pl = svg.querySelector('.pm-graph-line');
      if (pl) { pl.setAttribute('points', pts); pl.setAttribute('stroke', col); }

      // v2: Drift bias indicator
      const biasEl = this.el && this.el.querySelector('.pm-drift-bias');
      if (biasEl && bpms.length >= 4) {
        const avgBPM = bpms.reduce((a,b) => a+b, 0) / bpms.length;
        const drift = avgBPM - target;
        var biasText, biasColor;
        if (Math.abs(drift) < 1) { biasText = 'Trend: Locked in'; biasColor = '#22c55e'; }
        else if (drift > 3) { biasText = 'Trend: Rushing +' + drift.toFixed(1) + ' BPM'; biasColor = '#ef4444'; }
        else if (drift > 0) { biasText = 'Trend: Slightly rushing'; biasColor = '#f59e0b'; }
        else if (drift < -3) { biasText = 'Trend: Dragging ' + drift.toFixed(1) + ' BPM'; biasColor = '#ef4444'; }
        else { biasText = 'Trend: Slightly dragging'; biasColor = '#f59e0b'; }
        biasEl.textContent = biasText;
        biasEl.style.color = biasColor;
      }
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

      // ── Expose last groove score globally for Command Center ─────────────
      (function _pmUpdateGlobalScore(groove) {
        var prev = window._lastPocketScore || null;
        var score = groove.stabilityScore;
        window._lastPocketScore = score;
        window._lastPocketTrend = {
          direction: prev === null ? 'flat' : score > prev ? 'up' : score < prev ? 'down' : 'flat',
          delta:     prev === null ? 0 : score - prev
        };
      }(result.metrics));

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
        <div class="pm-nameplate"><div class="pm-nameplate-inner"><span>Pocket Meter</span></div></div>

        <!-- v2: Mode toggle — Live Tempo vs In The Pocket -->
        <div class="pm-mode-toggle" style="display:flex;justify-content:center;gap:0;margin:8px 16px 4px;border-radius:8px;overflow:hidden;border:1px solid #444;min-height:36px;flex-shrink:0">
          <button class="pm-mode-btn pm-mode-btn--active" data-pmmode="live" onclick="this.closest('.pm-root')._pmSwitchMode && this.closest('.pm-root')._pmSwitchMode('live')" style="flex:1;padding:10px 12px;background:#2a2a2a;border:none;color:#a5b4fc;font-weight:700;font-size:0.82em;cursor:pointer;letter-spacing:0.04em;min-height:36px">&#x1F3AF; LIVE TEMPO</button>
          <button class="pm-mode-btn" data-pmmode="pocket" onclick="this.closest('.pm-root')._pmSwitchMode && this.closest('.pm-root')._pmSwitchMode('pocket')" style="flex:1;padding:10px 12px;background:#1a1a1a;border:none;color:#64748b;font-weight:700;font-size:0.82em;cursor:pointer;letter-spacing:0.04em;min-height:36px">&#x1F3B5; IN THE POCKET</button>
        </div>

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
            <button class="pm-help-btn" title="Help" onclick="this.closest('.pm-root')._pmShowHelp && this.closest('.pm-root')._pmShowHelp()" style="width:36px;height:36px;border-radius:8px;background:linear-gradient(180deg,#2e2e2e,#1a1a1a);border:1px solid #555;color:#aaa;font-size:15px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 6px rgba(0,0,0,0.4);flex-shrink:0;touch-action:manipulation">?</button>
          </div>
        </div>

        <!-- Toolbar: multiplier + time sig + flash -->
        <div class="pm-toolbar">
          <button class="pm-mult-btn pm-mult--half" title="Half speed: detected BPM x0.5 — use if meter reads double your actual tempo">½x</button>
          <button class="pm-mult-btn pm-mult--1x pm-mult--active" title="Normal speed: BPM as detected">1x</button>
          <button class="pm-mult-btn pm-mult--2x" title="Double speed: detected BPM x2 — use if meter reads half your actual tempo">2x</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-sig-btn pm-sig--3" title="3/4 time">3/4</button>
          <button class="pm-sig-btn pm-sig--4 pm-sig--active" title="4/4 time">4/4</button>
          <button class="pm-sig-btn pm-sig--6" title="6/8 time">6/8</button>
          <button class="pm-sig-btn pm-sig--7" title="7/8 time">7/8</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-flash-btn" title="Screen flash: the display flashes green on each downbeat — useful in loud environments where you can't hear the click">⚡</button>
          <div class="pm-toolbar-divider"></div>
          <button class="pm-view-btn" data-view="float" title="Float over other pages">⧉</button>
          <button class="pm-view-btn" data-view="mini" title="Mini pill">▾</button>
          <button class="pm-view-btn" data-view="full" title="Exit float / dock">✕</button>
        </div>

        <!-- Help panel (hidden by default) -->
        <div class="pm-help-panel pm-hidden" style="background:#0a0a0a;border:1px solid #333;border-radius:10px;padding:14px 16px;font-size:12px;line-height:1.6;color:#ccc;box-shadow:inset 0 2px 8px rgba(0,0,0,0.6)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:11px;font-weight:800;color:#c8ff00;text-transform:uppercase;letter-spacing:0.12em">How to Use Pocket Meter</div>
            <button onclick="this.closest('.pm-root').querySelector('.pm-help-panel').classList.add('pm-hidden')" style="background:transparent;border:none;color:#666;font-size:16px;cursor:pointer;padding:0;line-height:1">×</button>
          </div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:8px">What It Does</div>
          <div>Pocket Meter listens to your band in real time and tells you whether you&apos;re rushing, dragging, or locked in. Set a target BPM, hit Listen, and watch the needle and live readout respond to your actual playing.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">&#xbd;x / 1x / 2x Multiplier</div>
          <div>If the meter reads <em>double</em> your real tempo (e.g. 240 when you&apos;re playing 120), tap <strong>&#xbd;x</strong>. If it reads <em>half</em>, tap <strong>2x</strong>. Use <strong>1x</strong> for normal detection. This is common with busy drum patterns.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">Tap Tempo</div>
          <div>Tap the <strong>Tap</strong> button in time with the music to set the target BPM manually. Useful before a song starts or when the auto-detect hasn&apos;t locked in yet. Tap at least 4 times for accuracy.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">Broadcast</div>
          <div>Sends your detected or tapped BPM to all band members currently in the app, so everyone sees the same target. Requires all members to be signed in.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">Count In</div>
          <div>Plays 2 bars of clicks at the target BPM before you start — helpful for getting in the pocket before the song begins. The second bar is louder so you know recording or playing is about to begin.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">Tempo History</div>
          <div>The graph shows how your live BPM drifted over the last ~30 seconds. Flat line = locked in. Spikes = rushing or dragging moments. Use it after a run-through to identify problem spots.</div>
          <div style="color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">Lock Session Tempo</div>
          <div>Locks the detected BPM as the session target and broadcasts it to all band members. This is a live session value — to permanently change a song&apos;s BPM, edit it in Song DNA.</div>
          <div style="color:#c8ff00;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;margin-top:10px">&#x2699; Calibration — Most Important</div>
          <div style="color:#e0e0e0">If the meter feels unresponsive or triggers on everything, calibration is your fix:</div>
          <div style="margin-top:6px;padding:8px 10px;background:rgba(200,255,0,0.04);border-left:2px solid #c8ff00;border-radius:0 6px 6px 0;font-size:11px">
            <strong style="color:#c8ff00">Sensitivity</strong> — controls how loud a sound needs to be to register as a beat. In a loud rehearsal room, go <em>lower</em> so only the kick drum triggers it. In a quiet setting, go <em>higher</em> to catch subtle playing.<br><br>
            <strong style="color:#c8ff00">Reactivity</strong> — controls how quickly the displayed BPM updates. <em>Smooth</em> averages more beats so the number stays stable but reacts slower. <em>Snappy</em> reacts to each beat immediately but can jump around more.<br><br>
            <strong>Recommended starting point:</strong> Sensitivity 3, Reactivity 3. If the number is jumping wildly, lower reactivity. If it&apos;s not picking up your playing, raise sensitivity.
          </div>
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
            <path class="pm-arc-track" d="M 38.7 131.4 A 80 80 0 1 1 161.3 131.4" fill="none" stroke="#0d0d0d" stroke-width="14" stroke-linecap="round"/>
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
          <button class="pm-tap-btn" title="Tap in time with the music to set target BPM manually — tap at least 4 times for accuracy">Tap</button>
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
            <button class="pm-broadcast-btn pm-hidden" title="Send this BPM to all band members in the app">📡 Broadcast</button>
            <button class="pm-lock-btn pm-hidden">💾 Lock Session Tempo</button>
          </div>
          <button class="pm-countin-btn" title="Plays 2 bars of click at target BPM before you start — second bar is louder as your cue">Count In</button>
        </div>

        <!-- Drift bias indicator (v2) -->
        <div class="pm-drift-bias" style="text-align:center;font-size:0.72em;font-weight:700;color:#64748b;padding:2px 0"></div>

        <!-- Tempo history graph + controls -->
        <div class="pm-graph-section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div class="pm-graph-label" style="margin:0" title="Shows how your live BPM drifted. Flat = locked in. Spikes = rushing or dragging.">Tempo History</div>
            <div style="display:flex;gap:2px">
              <button class="pm-zoom-btn pm-zoom--active" data-zoom="30" onclick="this.closest('.pm-root')._pmSetZoom && this.closest('.pm-root')._pmSetZoom(30)" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#94a3b8;padding:2px 6px;border-radius:4px;font-size:0.65em;cursor:pointer">30s</button>
              <button class="pm-zoom-btn" data-zoom="120" onclick="this.closest('.pm-root')._pmSetZoom && this.closest('.pm-root')._pmSetZoom(120)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.65em;cursor:pointer">2m</button>
              <button class="pm-zoom-btn" data-zoom="300" onclick="this.closest('.pm-root')._pmSetZoom && this.closest('.pm-root')._pmSetZoom(300)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.65em;cursor:pointer">5m</button>
              <button class="pm-zoom-btn" data-zoom="600" onclick="this.closest('.pm-root')._pmSetZoom && this.closest('.pm-root')._pmSetZoom(600)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.65em;cursor:pointer">10m</button>
            </div>
          </div>
          <svg class="pm-history-graph" viewBox="0 0 280 60" preserveAspectRatio="none">
            <!-- Drift shading zones -->
            <!-- v3: Multi-color drift zones — positioned dynamically by _updateGraph -->
            <rect class="pm-graph-zone-red-top" x="0" y="0" width="280" height="12" fill="#ef4444" opacity="0.03"/>
            <rect class="pm-graph-zone-yellow-top" x="0" y="12" width="280" height="8" fill="#f59e0b" opacity="0.04"/>
            <rect class="pm-graph-zone-green" x="0" y="20" width="280" height="20" fill="#22c55e" opacity="0.05"/>
            <rect class="pm-graph-zone-yellow-bot" x="0" y="40" width="280" height="8" fill="#f59e0b" opacity="0.04"/>
            <rect class="pm-graph-zone-red-bot" x="0" y="48" width="280" height="12" fill="#ef4444" opacity="0.03"/>
            <line class="pm-graph-target-line" x1="0" y1="30" x2="280" y2="30" stroke="#4ade80" stroke-width="0.5" stroke-dasharray="4 4" opacity="0.3"/>
            <polyline class="pm-graph-line" points="" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <!-- BPM range presets -->
          <div style="display:flex;gap:4px;margin-top:4px;justify-content:center">
            <button onclick="this.closest('.pm-root')._pmSetRange && this.closest('.pm-root')._pmSetRange(60,100)" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.58em;cursor:pointer">Slow</button>
            <button onclick="this.closest('.pm-root')._pmSetRange && this.closest('.pm-root')._pmSetRange(80,140)" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.58em;cursor:pointer">Mid</button>
            <button onclick="this.closest('.pm-root')._pmSetRange && this.closest('.pm-root')._pmSetRange(120,200)" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.58em;cursor:pointer">Fast</button>
            <button onclick="this.closest('.pm-root')._pmSetRange && this.closest('.pm-root')._pmSetRange(40,220)" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#64748b;padding:2px 6px;border-radius:4px;font-size:0.58em;cursor:pointer">All</button>
          </div>
        </div>

        <!-- Drift report (shown after stop) -->
        <div class="pm-drift-report pm-hidden">
          <div class="pm-drift-title">Session Report</div>
          <div class="pm-drift-body"></div>
          <button class="pm-drift-close">Dismiss</button>
        </div>

        <!-- BPM save prompt (shown when user adjusts target BPM) -->
        <div class="pm-bpm-prompt pm-hidden">
          <div class="pm-bpm-prompt-msg">Lock <span class="pm-bpm-prompt-val"></span> BPM as session tempo?</div>
          <div class="pm-bpm-prompt-btns">
            <button class="pm-bpm-save-yes" title="Lock this tempo for the session and broadcast to all members">Lock Tempo</button>
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

      // Guided overlay — lays over the legacy chrome when guided mode is on.
      // Purely additive: setting `_guided = false` hides this overlay and the
      // original UI is fully functional underneath.
      this._buildGuidedOverlay();
      this._buildGuidedReturnChip();
      this._renderGuidedState();
    }

    // Small pinned chip that appears only when _guided is false, giving users
    // a way back to the guided chooser from anywhere in the legacy UI.
    _buildGuidedReturnChip() {
      if (!this.el || this.el.querySelector('.pm-guided-return')) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pm-guided-return';
      chip.innerHTML = '&#9664; Guided mode';
      chip.title = 'Return to guided pocket meter';
      const self = this;
      chip.addEventListener('click', function () {
        self._guided = true;
        localStorage.setItem('pm_guided_mode', '1');
        self._renderGuidedState();
      });
      this.el.appendChild(chip);
    }

    // ── Guided Mode (v2) ──────────────────────────────────────────────────────
    _buildGuidedOverlay() {
      if (!this.el || this.el.querySelector('.pm-guided')) return;
      const overlay = document.createElement('div');
      overlay.className = 'pm-guided';
      overlay.innerHTML = `
        <!-- CHOOSER: shown when unlocked -->
        <div class="pm-guided-chooser">
          <div class="pm-guided-title">Lock the groove to start</div>
          <button class="pm-guided-opt pm-opt-song" type="button">
            <span class="pm-opt-icon">&#127919;</span>
            <span class="pm-opt-label">Use song BPM</span>
            <span class="pm-opt-value pm-opt-song-val">—</span>
          </button>
          <div class="pm-guided-opt pm-opt-type">
            <span class="pm-opt-icon">&#9000;</span>
            <span class="pm-opt-label">Type BPM</span>
            <input type="number" class="pm-opt-input" min="40" max="220" step="1" placeholder="120" inputmode="numeric">
            <button class="pm-opt-go" type="button">Lock</button>
          </div>
          <div class="pm-guided-foot">
            <label class="pm-guided-exp">
              <input type="checkbox" class="pm-exp-toggle">
              <span>Experimental auto-detect</span>
            </label>
          </div>
        </div>

        <!-- LOCKED: shown once a BPM is locked -->
        <div class="pm-guided-locked pm-hidden">
          <div class="pm-locked-ref">Locked at <span class="pm-locked-bpm">120</span> BPM</div>
          <div class="pm-locked-head">
            <span class="pm-locked-label">YOU&#39;RE AT</span>
            <span class="pm-actual-bpm">—</span>
            <span class="pm-locked-unit">BPM</span>
          </div>
          <div class="pm-locked-meter">
            <span class="pm-meter-left">Dragging</span>
            <div class="pm-meter-track"><div class="pm-meter-dot"></div></div>
            <span class="pm-meter-right">Rushing</span>
          </div>
          <div class="pm-locked-tier">Listening…</div>
          <div class="pm-locked-conf">—</div>
          <div class="pm-locked-feel">
            <span class="pm-feel-label">Groove Feel:</span>
            <div class="pm-feel-seg">
              <button class="pm-feel-btn" data-feel="tight" type="button">Tight</button>
              <button class="pm-feel-btn pm-feel-active" data-feel="normal" type="button">Normal</button>
              <button class="pm-feel-btn" data-feel="loose" type="button">Loose</button>
            </div>
          </div>
          <button class="pm-locked-reset" type="button">Reset lock</button>
        </div>
      `;
      this.el.insertBefore(overlay, this.el.firstChild);
      this._wireGuidedOverlay();
    }

    _wireGuidedOverlay() {
      const self = this;
      const overlay = this.el.querySelector('.pm-guided');
      if (!overlay) return;

      // Use song BPM
      const songBtn = overlay.querySelector('.pm-opt-song');
      if (songBtn) songBtn.addEventListener('click', function () {
        const bpm = Number(self.targetBPM);
        if (!bpm || bpm < 40 || bpm > 220) return;
        self._enterLockedMode(Math.round(bpm));
      });

      // Type BPM
      const typeInput = overlay.querySelector('.pm-opt-input');
      const typeGo = overlay.querySelector('.pm-opt-go');
      const submitTyped = function () {
        const v = Number(typeInput && typeInput.value);
        if (!v || v < 40 || v > 220) {
          if (typeInput) { typeInput.classList.add('pm-shake'); setTimeout(function () { typeInput.classList.remove('pm-shake'); }, 300); }
          return;
        }
        self._enterLockedMode(Math.round(v));
      };
      if (typeGo) typeGo.addEventListener('click', submitTyped);
      if (typeInput) typeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitTyped(); }
      });

      // Experimental auto-detect toggle
      const expToggle = overlay.querySelector('.pm-exp-toggle');
      if (expToggle) {
        expToggle.checked = !this._guided;
        expToggle.addEventListener('change', function () {
          self._guided = !expToggle.checked;
          localStorage.setItem('pm_guided_mode', self._guided ? '1' : '0');
          self._renderGuidedState();
        });
      }

      // Reset lock
      const resetBtn = overlay.querySelector('.pm-locked-reset');
      if (resetBtn) resetBtn.addEventListener('click', function () { self._resetLock(); });

      // Groove Feel selector (wired in commit 3; visible but cosmetic for now)
      const feelBtns = overlay.querySelectorAll('.pm-feel-btn');
      feelBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          feelBtns.forEach(function (b) { b.classList.remove('pm-feel-active'); });
          btn.classList.add('pm-feel-active');
        });
      });
    }

    async _enterLockedMode(bpm) {
      this._lockedBPM  = bpm;
      this._lockedAtMs = performance.now();
      this._guidedOnsets = [];
      this._dotPct = 50;
      this._renderGuidedState();
      // Start mic (user gesture = the Lock button tap).
      await this._startGuidedListening();
      // Run the classifier on a steady 250ms tick independent of onset rate
      // so the UI always reflects current state (including "Listening…").
      if (this._classifierInterval) clearInterval(this._classifierInterval);
      var self = this;
      this._classifierInterval = setInterval(function () { self._tickGuidedClassifier(); }, 250);
    }

    _resetLock() {
      this._lockedBPM  = null;
      this._lockedAtMs = null;
      this._guidedOnsets = [];
      this._smoothedActualBPM = null;
      this._dotPct = 50;
      if (this._classifierInterval) { clearInterval(this._classifierInterval); this._classifierInterval = null; }
      // Leave the engine running if the user was in legacy mic mode previously;
      // otherwise tear it down so the mic indicator clears.
      if (!this.listening && this.engine) {
        try { this.engine.stop(); } catch (e) {}
        this.engine = null;
      }
      this._renderGuidedState();
    }

    async _startGuidedListening() {
      var self = this;
      if (!this.engine) {
        this.engine = new BPMEngine(function (bpm) { /* guided ignores BPM; uses onsets */ });
        const ok = await this.engine.start();
        if (!ok) {
          this._guidedShowError('Mic access denied — tap Reset and allow mic access in Settings.');
          return;
        }
      }
      this.engine.onOnset = function (t) { self._onGuidedOnset(t); };

      // iOS aggressively suspends AudioContext on tab switch / other audio
      // events. Resume when the tab becomes visible again — otherwise the
      // analyser goes silent and the meter hangs on "Listening…".
      if (!this._visibilityHandler) {
        this._visibilityHandler = function () {
          if (document.visibilityState === 'visible' &&
              self.engine && self.engine.audioCtx &&
              self.engine.audioCtx.state === 'suspended') {
            self.engine.audioCtx.resume().catch(function () {});
          }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
      }
    }

    _onGuidedOnset(tMs) {
      if (this._lockedBPM == null) return;
      this._guidedOnsets.push(tMs);
      // Keep last 6 seconds of onsets (4s window + buffer).
      var cutoff = tMs - 6000;
      while (this._guidedOnsets.length && this._guidedOnsets[0] < cutoff) {
        this._guidedOnsets.shift();
      }
    }

    // Pure classifier — IOI-based tempo comparison (not phase). Measures
    // the actual BPM you're playing at from the median inter-onset interval,
    // compares to the locked BPM, and labels the delta. Phase-insensitive, so
    // large tempo mismatches don't alias onto the wrong beat (the bug at 131
    // vs 120 that showed "Dragging" because claps drifted >half a beat off).
    _classifyGuided(onsets, lockedBPM, lockedAtMs) {
      const lockedBeatMs = 60000 / lockedBPM;
      const now      = performance.now();
      const windowMs = 4000;
      const cutoff   = now - windowMs;

      const inWindow = [];
      for (var i = 0; i < onsets.length; i++) if (onsets[i] > cutoff) inWindow.push(onsets[i]);

      if (inWindow.length < 3) {
        return { label: 'Listening\u2026', tierClass: 'listening', confLabel: '\u2014', dotPct: 50, actualBPM: null };
      }

      // Inter-onset intervals
      const iois = [];
      for (var j = 1; j < inWindow.length; j++) iois.push(inWindow[j] - inWindow[j - 1]);

      // Reject obvious outliers (rests, skipped beats, double-triggers).
      // Keep intervals within ~40%..250% of the locked beat period.
      const valid = iois.filter(function (v) {
        return v >= lockedBeatMs * 0.4 && v <= lockedBeatMs * 2.5;
      });
      if (valid.length < 4) {
        return { label: 'Finding the groove\u2026', tierClass: 'listening', confLabel: 'Warming up', dotPct: 50, actualBPM: null };
      }

      // Median IOI → actual BPM (robust to occasional mis-detections).
      const sorted = valid.slice().sort(function (a, b) { return a - b; });
      const medianIOI = sorted[Math.floor(sorted.length / 2)];
      const actualBPM = 60000 / medianIOI;

      // Confidence: how tight are the IOIs around the median?
      var variance = 0;
      for (var k = 0; k < valid.length; k++) variance += (valid[k] - medianIOI) * (valid[k] - medianIOI);
      variance /= valid.length;
      const stdDev = Math.sqrt(variance);

      var confidence, confLabel;
      if (stdDev < 12)      { confidence = 'strong'; confLabel = 'Solid Lock'; }
      else if (stdDev < 28) { confidence = 'medium'; confLabel = 'Medium Lock'; }
      else                  { confidence = 'weak';   confLabel = 'Uncertain'; }

      const bpmDelta = actualBPM - lockedBPM;

      // Label with forgiving threshold — human clapping has 1–3 BPM jitter
      // even when perfectly on tempo. 2 BPM = ~8ms at 120, comfortably inside
      // a musician's sense of "on."
      var label, tierClass;
      if (confidence === 'weak')        { label = 'Uncertain'; tierClass = 'uncertain'; }
      else if (Math.abs(bpmDelta) <= 2) { label = 'Locked In'; tierClass = 'locked'; }
      else if (bpmDelta > 0)            { label = 'Rushing';   tierClass = 'rushing'; }
      else                              { label = 'Dragging';  tierClass = 'dragging'; }

      // Dot position: ±10 BPM = full meter deflection.
      // Positive delta = rushing = right (matches the UI labels).
      const maxDelta = 10;
      const clamped  = Math.max(-maxDelta, Math.min(maxDelta, bpmDelta));
      const dotPct   = 50 + (clamped / maxDelta) * 50;

      return { label: label, tierClass: tierClass, confLabel: confLabel, dotPct: dotPct, actualBPM: actualBPM, bpmDelta: bpmDelta };
    }

    _tickGuidedClassifier() {
      if (this._lockedBPM == null || this._lockedAtMs == null) return;
      const r = this._classifyGuided(this._guidedOnsets, this._lockedBPM, this._lockedAtMs);
      this._paintGuidedResult(r);
    }

    _paintGuidedResult(r) {
      if (!this.el) return;
      const overlay = this.el.querySelector('.pm-guided-locked');
      if (!overlay) return;

      // EMA-damped dot — calm motion, never twitchy.
      if (this._dotPct == null) this._dotPct = 50;
      const alpha = 0.22;
      this._dotPct = this._dotPct * (1 - alpha) + r.dotPct * alpha;

      const dot = overlay.querySelector('.pm-meter-dot');
      if (dot) {
        dot.style.left = this._dotPct.toFixed(1) + '%';
        // Color: green when locked, amber when drifting, grey when uncertain/listening
        const color = r.tierClass === 'locked'   ? '#22c55e'
                    : r.tierClass === 'rushing'  ? '#f59e0b'
                    : r.tierClass === 'dragging' ? '#f59e0b'
                    : '#475569';
        dot.style.background = color;
        dot.style.boxShadow = '0 0 8px ' + color + '55';
      }

      const tierEl = overlay.querySelector('.pm-locked-tier');
      if (tierEl) {
        tierEl.textContent = r.label;
        tierEl.className = 'pm-locked-tier pm-tier-' + r.tierClass;
      }

      const confEl = overlay.querySelector('.pm-locked-conf');
      if (confEl) confEl.textContent = r.confLabel;

      // Actual BPM — the primary reading. EMA-damped so it reads like a
      // speedometer, not a dice roll.
      const actualEl = overlay.querySelector('.pm-actual-bpm');
      if (actualEl) {
        if (r.actualBPM == null) {
          actualEl.textContent = '\u2014';
          this._smoothedActualBPM = null;
        } else {
          if (this._smoothedActualBPM == null) this._smoothedActualBPM = r.actualBPM;
          else this._smoothedActualBPM = this._smoothedActualBPM * 0.7 + r.actualBPM * 0.3;
          actualEl.textContent = this._smoothedActualBPM.toFixed(1);
        }
      }
    }

    _guidedShowError(msg) {
      if (!this.el) return;
      const tier = this.el.querySelector('.pm-locked-tier');
      const conf = this.el.querySelector('.pm-locked-conf');
      if (tier) { tier.textContent = '\u26A0 ' + msg; tier.className = 'pm-locked-tier pm-tier-uncertain'; }
      if (conf) conf.textContent = '';
    }

    _renderGuidedState() {
      if (!this.el) return;
      const overlay = this.el.querySelector('.pm-guided');
      const returnChip = this.el.querySelector('.pm-guided-return');
      if (!overlay) return;

      // Toggle overlay visibility based on guided mode setting.
      if (this._guided) {
        overlay.classList.remove('pm-hidden');
        this.el.classList.add('pm-guided-active');
        if (returnChip) returnChip.classList.add('pm-hidden');
      } else {
        overlay.classList.add('pm-hidden');
        this.el.classList.remove('pm-guided-active');
        if (returnChip) returnChip.classList.remove('pm-hidden');
        return;
      }

      const chooser = overlay.querySelector('.pm-guided-chooser');
      const locked  = overlay.querySelector('.pm-guided-locked');

      if (this._lockedBPM == null) {
        // CHOOSER view
        chooser.classList.remove('pm-hidden');
        locked.classList.add('pm-hidden');

        // Populate / gate the song-BPM option
        const songBtn = overlay.querySelector('.pm-opt-song');
        const songVal = overlay.querySelector('.pm-opt-song-val');
        const tgt = Number(this.targetBPM);
        if (tgt && tgt >= 40 && tgt <= 220) {
          songBtn.removeAttribute('disabled');
          songBtn.classList.remove('pm-opt-disabled');
          if (songVal) songVal.textContent = String(Math.round(tgt));
        } else {
          songBtn.setAttribute('disabled', 'disabled');
          songBtn.classList.add('pm-opt-disabled');
          if (songVal) songVal.textContent = '— not set —';
        }
      } else {
        // LOCKED view
        chooser.classList.add('pm-hidden');
        locked.classList.remove('pm-hidden');
        const bpmEl = overlay.querySelector('.pm-locked-bpm');
        if (bpmEl) bpmEl.textContent = String(this._lockedBPM);
      }
    }

    // Override existing setTargetBPM so the chooser's "Use song BPM" stays fresh.
    // ── End Guided Mode (v2) ──────────────────────────────────────────────────

    // ── Styles ─────────────────────────────────────────────────────────────────

    _injectStyles() {
      var existing = document.getElementById('pm-styles');
      if (existing && existing.textContent && existing.textContent.length > 100) return;
      if (existing) existing.remove();
      const s = document.createElement('style');
      s.id = 'pm-styles';
      s.textContent = `
        /* ── Root ──────────────────────────────────────────────────────────── */
        .pm-root {
          --pm-bg:        #161616;
          --pm-surface:   #1e1e1e;
          --pm-border:    #3a3a3a;
          --pm-green:     #c8ff00;
          --pm-yellow:    #fbbf24;
          --pm-red:       #ff4444;
          --pm-blue:      #818cf8;
          --pm-text:      #e0e0e0;
          --pm-muted:     #666;
          --pm-radius:    12px;
          --pm-font:      system-ui, -apple-system, sans-serif;
          --pm-gold:      #d4a843;
          --pm-led:       #c8ff00;

          /* Pedal body */
          background:
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.012) 0px,
              rgba(255,255,255,0.012) 1px,
              transparent 1px,
              transparent 4px
            ),
            linear-gradient(160deg, #2e2e2e 0%, #1c1c1c 50%, #111 100%);
          border: 2px solid #555;
          border-radius: 18px;
          padding: 18px 16px 16px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          position: relative;
          font-family: var(--pm-font);
          color: var(--pm-text);
          max-width: 400px;
          width: 100%;
          margin: 0 auto;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          box-shadow:
            0 12px 40px rgba(0,0,0,0.8),
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -3px 6px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }

        /* Corner bolts */
        .pm-root::before, .pm-root::after {
          content: '';
          position: absolute;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #888, #333);
          box-shadow: 0 2px 4px rgba(0,0,0,0.8);
          z-index: 2;
          pointer-events: none;
        }
        .pm-root::before { top: 9px; left: 9px; }
        .pm-root::after  { top: 9px; right: 9px; }

        /* Gold nameplate injected via banner repurpose */
        .pm-nameplate {
          text-align: center;
          margin-bottom: 4px;
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .pm-nameplate-inner {
          display: inline-block;
          background: linear-gradient(180deg, #d4a843 0%, #8b6010 50%, #c8922a 100%);
          border-radius: 4px;
          padding: 3px 18px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3);
        }
        .pm-nameplate-inner span {
          font-size: 0.62em;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #1a0e00;
          line-height: 1;
          display: block;
          padding-top: 1px;
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
          padding: 0 2px; position: relative;
        }
        .pm-header-left { display: flex; align-items: baseline; gap: 6px; flex: 1; justify-content: center; }
        .pm-header-label { font-size: 10px; color: var(--pm-muted); letter-spacing: 0.1em; text-transform: uppercase; }
        .pm-target-row { display: flex; align-items: center; gap: 4px; }
        .pm-target-bpm {
          font-size: 32px; font-weight: 900; color: var(--pm-led);
          letter-spacing: -0.03em; min-width: 56px; text-align: center; line-height: 1;
          font-family: monospace;
          text-shadow: 0 0 8px rgba(200,255,0,0.8), 0 0 16px rgba(200,255,0,0.4);
        }
        .pm-mode-gig .pm-target-bpm { font-size: 40px; }
        .pm-bpm-adj {
          width: 28px; height: 28px; border-radius: 50%;
          background: linear-gradient(180deg, #3a3a3a, #222);
          border: 1px solid #555;
          color: #ccc; font-size: 16px; font-weight: 300;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; line-height: 1; padding: 0;
          box-shadow: 0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .pm-bpm-adj:hover { border-color: var(--pm-led); color: var(--pm-led); }
        .pm-bpm-adj:active { transform: scale(0.92) translateY(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
        .pm-header-right { display: flex; align-items: center; gap: 6px; }
        .pm-settings-btn {
          width: 36px; height: 36px; border-radius: 8px;
          background: linear-gradient(180deg,#2e2e2e,#1a1a1a); border: 1px solid #555;
          color: var(--pm-muted); font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; touch-action: manipulation;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .pm-settings-btn:hover { color: var(--pm-text); border-color: var(--pm-blue); }
        .pm-settings-btn.pm-active { color: var(--pm-blue); border-color: var(--pm-blue); background: rgba(129,140,248,0.1); }

        /* ── Toolbar ────────────────────────────────────────────────────────── */
        .pm-toolbar {
          display: flex; align-items: center; gap: 2px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 10px; padding: 4px 6px; flex-wrap: wrap; overflow: visible;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.6); gap: 3px;
        }
        .pm-mult-btn, .pm-sig-btn {
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #444;
          color: var(--pm-muted); font-family: var(--pm-font); font-size: 11px;
          font-weight: 700; padding: 4px 6px; border-radius: 6px;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.04em;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
          min-width: 0;
        }
        .pm-mult-btn:hover, .pm-sig-btn:hover { color: var(--pm-text); border-color: #666; }
        .pm-mult--active, .pm-sig--active {
          background: linear-gradient(180deg, #1a2a00, #0d1800) !important;
          border-color: var(--pm-led) !important;
          color: var(--pm-led) !important;
          box-shadow: 0 0 6px rgba(200,255,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }
        .pm-toolbar-divider { width: 1px; height: 14px; background: #333; margin: 0 2px; flex-shrink: 0; }
        .pm-flash-btn {
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #444;
          font-size: 13px; padding: 4px 6px; border-radius: 6px;
          cursor: pointer; opacity: 0.5; transition: all 0.15s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }
        .pm-flash-btn:hover { opacity: 0.9; }
        .pm-flash-btn--active {
          opacity: 1 !important;
          border-color: var(--pm-yellow) !important;
          box-shadow: 0 0 6px rgba(251,191,36,0.4) !important;
        }
        .pm-view-btn {
          background: linear-gradient(180deg, #2a2a2a, #1a1a1a);
          border: 1px solid #444;
          color: var(--pm-muted); font-size: 13px; padding: 4px 6px;
          border-radius: 6px; cursor: pointer; transition: all 0.15s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.4);
          min-width: 0;
        }
        .pm-view-btn:hover { color: var(--pm-text); border-color: #666; }

        /* ── Settings panel ─────────────────────────────────────────────────── */
        .pm-settings-panel {
          background: #0a0a0a; border: 1px solid #333;
          border-radius: 10px; padding: 12px 14px;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
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
        .pm-live-bpm {
          font-size: 40px; font-weight: 900; color: var(--pm-led);
          letter-spacing: -0.04em; font-family: monospace;
          text-shadow: 0 0 10px rgba(200,255,0,0.9), 0 0 20px rgba(200,255,0,0.5), 0 0 40px rgba(200,255,0,0.2);
        }
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
          flex: 1; min-width: 0; padding: 10px 8px; border-radius: 10px;
          font-family: var(--pm-font); font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.04em;
          background: linear-gradient(180deg, #2e2e2e, #1a1a1a);
          border: 1px solid #555;
          color: var(--pm-text);
          box-shadow: 0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
          -webkit-appearance: none; appearance: none;
        }
        .pm-controls button:hover { border-color: var(--pm-led); color: var(--pm-led); }
        .pm-controls button:active { transform: scale(0.97) translateY(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.5); }
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
          background: #0a0a0a; border: 1px solid #333;
          border-radius: 10px; padding: 8px 10px;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
        }
        .pm-graph-label { font-size: 10px; color: var(--pm-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
        .pm-history-graph { width: 100%; height: 50px; display: block; }

        /* ── Drift report ───────────────────────────────────────────────────── */
        .pm-drift-report {
          background: #0a0a0a; border: 1px solid rgba(200,255,0,0.2);
          border-radius: 10px; padding: 12px 14px;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
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
          display: flex; gap: 0; margin-bottom: 8px;
          background: #0a0a0a; border-radius: 8px; border: 1px solid #333;
          overflow: hidden; box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);
        }
        .pm-src-btn {
          flex: 1; min-width: 0; padding: 7px 4px; font-size: 10px; font-weight: 700;
          letter-spacing: 0.05em; cursor: pointer;
          border: none; border-right: 1px solid #333;
          background: linear-gradient(180deg, #1e1e1e, #141414);
          color: var(--pm-muted); transition: all 0.15s; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;
        }
        .pm-src-btn:last-child { border-right: none; }
        .pm-src-btn.pm-src--active {
          background: linear-gradient(180deg, #1a2a00, #0d1800);
          color: var(--pm-led);
          box-shadow: inset 0 0 8px rgba(200,255,0,0.15);
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
          box-shadow: 0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,255,0,0.2);
          background: rgba(15,15,15,0.95); backdrop-filter: blur(12px);
          border: 1px solid #444;
        }
        .pm-root.pm-mini::before, .pm-root.pm-mini::after { display: none !important; }
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

        /* ── Guided Mode (v2) overlay ─────────────────────────────────────── */
        .pm-root .pm-guided {
          position: absolute; inset: 0; background: #161616;
          z-index: 20; display: flex; flex-direction: column;
          align-items: stretch; justify-content: center;
          padding: 20px 18px;
          border-radius: inherit;
        }
        .pm-root.pm-guided-active { position: relative; }
        /* Hide legacy UI beneath the overlay while guided mode is active */
        .pm-root.pm-guided-active > *:not(.pm-guided) { visibility: hidden; pointer-events: none; }

        /* Chooser */
        .pm-guided-title {
          font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase;
          color: #94a3b8; font-weight: 700; text-align: center; margin-bottom: 16px;
        }
        .pm-guided-opt {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 14px 14px; margin-bottom: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; color: #e0e0e0; cursor: pointer;
          font-family: inherit; font-size: 0.92rem; text-align: left;
          min-height: 52px; -webkit-tap-highlight-color: transparent;
        }
        .pm-guided-opt:hover:not(.pm-opt-disabled):not([disabled]),
        .pm-guided-opt:active:not(.pm-opt-disabled):not([disabled]) {
          background: rgba(129,140,248,0.1); border-color: rgba(129,140,248,0.35);
        }
        .pm-guided-opt.pm-opt-disabled, .pm-guided-opt[disabled] {
          opacity: 0.45; cursor: not-allowed;
        }
        .pm-opt-icon { font-size: 1.1rem; flex-shrink: 0; width: 24px; text-align: center; }
        .pm-opt-label { flex: 1; font-weight: 600; }
        .pm-opt-value {
          font-size: 0.85rem; color: #a5b4fc; font-weight: 700; font-variant-numeric: tabular-nums;
        }
        .pm-opt-disabled .pm-opt-value { color: #64748b; font-weight: 400; font-size: 0.75rem; }

        .pm-opt-type { cursor: default; }
        .pm-opt-type:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        .pm-opt-input {
          width: 68px; padding: 8px 10px; background: #0a0a0a; border: 1px solid #333;
          border-radius: 6px; color: #e0e0e0; font-family: inherit; font-size: 0.95rem;
          font-weight: 700; text-align: center; font-variant-numeric: tabular-nums;
        }
        .pm-opt-input:focus { outline: none; border-color: #818cf8; }
        .pm-opt-input.pm-shake { animation: pm-shake 0.28s ease; border-color: #ef4444; }
        @keyframes pm-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        .pm-opt-go {
          padding: 8px 14px; background: #818cf8; border: none; border-radius: 6px;
          color: #0a0a0a; font-family: inherit; font-weight: 800; font-size: 0.78rem;
          letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
          min-height: 36px;
        }
        .pm-opt-go:active { background: #6366f1; }

        .pm-guided-foot { margin-top: 14px; text-align: center; }
        .pm-guided-exp {
          display: inline-flex; align-items: center; gap: 8px;
          color: #64748b; font-size: 0.78rem; cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .pm-guided-exp input { width: 14px; height: 14px; cursor: pointer; }

        /* Locked — reference chip above, actual BPM primary */
        .pm-locked-ref {
          text-align: center; font-size: 0.72rem; letter-spacing: 0.06em;
          color: #64748b; font-weight: 600; margin-bottom: 8px;
        }
        .pm-locked-ref .pm-locked-bpm {
          color: #a5b4fc; font-weight: 700; font-variant-numeric: tabular-nums;
        }
        .pm-locked-head {
          text-align: center; margin-bottom: 18px;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
        }
        .pm-locked-label {
          font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b; font-weight: 700;
        }
        .pm-actual-bpm {
          font-size: 3.2rem; font-weight: 800; color: #e0e0e0;
          font-variant-numeric: tabular-nums; line-height: 1; margin-top: 2px;
        }
        .pm-locked-unit { font-size: 0.72rem; letter-spacing: 0.14em; color: #64748b; font-weight: 700; }

        .pm-locked-meter {
          display: flex; align-items: center; gap: 10px;
          margin: 6px 0 18px; padding: 0 4px;
        }
        .pm-meter-left, .pm-meter-right {
          font-size: 0.62rem; letter-spacing: 0.06em; text-transform: uppercase;
          color: #64748b; font-weight: 700; flex-shrink: 0;
        }
        .pm-meter-track {
          flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; position: relative;
          overflow: visible;
        }
        .pm-meter-track::after {
          content: ''; position: absolute; left: 50%; top: -3px; width: 2px; height: 12px;
          background: rgba(255,255,255,0.15); transform: translateX(-50%);
        }
        .pm-meter-dot {
          position: absolute; top: 50%; left: 50%;
          width: 14px; height: 14px; border-radius: 50%;
          background: #22c55e; transform: translate(-50%, -50%);
          transition: left 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s;
          box-shadow: 0 0 8px rgba(34,197,94,0.5);
        }

        .pm-locked-tier {
          text-align: center; font-size: 1.4rem; font-weight: 800; letter-spacing: 0.02em;
          color: #22c55e; margin: 4px 0 2px; line-height: 1.2;
        }
        .pm-locked-tier.pm-tier-rushing,
        .pm-locked-tier.pm-tier-dragging { color: #f59e0b; }
        .pm-locked-tier.pm-tier-uncertain { color: #64748b; }
        .pm-locked-tier.pm-tier-listening { color: #64748b; font-size: 1.1rem; font-weight: 600; font-style: italic; }

        .pm-locked-conf {
          text-align: center; font-size: 0.78rem; color: #94a3b8; margin-bottom: 18px; min-height: 18px;
        }

        .pm-locked-feel {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          margin-bottom: 14px;
        }
        .pm-feel-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
        .pm-feel-seg {
          display: inline-flex; border-radius: 7px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .pm-feel-btn {
          padding: 6px 12px; background: transparent; border: none; color: #64748b;
          font-family: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer;
          letter-spacing: 0.04em; min-height: 32px;
          -webkit-tap-highlight-color: transparent;
        }
        .pm-feel-btn + .pm-feel-btn { border-left: 1px solid rgba(255,255,255,0.1); }
        .pm-feel-btn.pm-feel-active { background: rgba(129,140,248,0.18); color: #a5b4fc; }

        .pm-locked-reset {
          display: block; margin: 6px auto 0; padding: 10px 20px;
          background: transparent; border: 1px solid rgba(255,255,255,0.14);
          border-radius: 8px; color: #94a3b8;
          font-family: inherit; font-size: 0.8rem; font-weight: 700;
          letter-spacing: 0.04em; cursor: pointer; min-height: 40px;
          -webkit-tap-highlight-color: transparent;
        }
        .pm-locked-reset:active { background: rgba(255,255,255,0.04); color: #e0e0e0; }

        .pm-guided .pm-hidden { display: none !important; }

        /* Return-to-guided chip — shown only when in legacy auto-detect */
        .pm-guided-return {
          position: absolute; top: 10px; right: 10px; z-index: 30;
          padding: 6px 12px; background: rgba(15,23,42,0.92);
          border: 1px solid rgba(129,140,248,0.4); border-radius: 999px;
          color: #a5b4fc; font-family: inherit; font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.04em; cursor: pointer;
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          -webkit-tap-highlight-color: transparent;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .pm-guided-return:active { background: rgba(99,102,241,0.3); color: #e0e7ff; }
        .pm-guided-return.pm-hidden { display: none !important; }
      `;
      document.head.appendChild(s);
    }
  }

  // Export
  global.PocketMeter = PocketMeter;
  global.OfflineAnalyser = OfflineAnalyser;
  global.GrooveAnalyser = GrooveAnalyser;
  global.PocketMeterTimeSeries = PocketMeterTimeSeries;

})(window);
