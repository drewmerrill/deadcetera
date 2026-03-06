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
  // Onset-energy based beat detection via Web Audio API
  // Accumulates inter-onset intervals, median-filters to produce stable BPM

  class BPMEngine {
    constructor(onBPM) {
      this.onBPM = onBPM;
      this.audioCtx = null;
      this.analyser = null;
      this.stream = null;
      this.source = null;
      this.running = false;
      this.onsets = [];          // timestamps of detected onsets
      this.prevEnergy = 0;
      this.bufferSize = 2048;
      this.raf = null;
      this.lastBPM = null;
      this.smoothedBPM = null;
    }

    async start() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = this.bufferSize;
        this.analyser.smoothingTimeConstant = 0.3;
        this.source = this.audioCtx.createMediaStreamSource(this.stream);
        this.source.connect(this.analyser);
        this.running = true;
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
      this.onsets = [];
      this.smoothedBPM = null;
    }

    _tick() {
      if (!this.running) return;
      this.raf = requestAnimationFrame(() => this._tick());

      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);

      // Focus on kick/snare range: roughly 60Hz–4kHz
      const sampleRate = this.audioCtx.sampleRate;
      const binHz = sampleRate / this.bufferSize;
      const loB = Math.floor(60 / binHz);
      const hiB = Math.min(Math.floor(4000 / binHz), data.length - 1);

      let energy = 0;
      for (let i = loB; i <= hiB; i++) energy += data[i] * data[i];
      energy /= (hiB - loB + 1);

      const now = performance.now();
      const threshold = this.prevEnergy * (this._sensitivityMult || 1.4) + 30;

      if (energy > threshold && energy > 500) {
        // Onset detected — enforce min 250ms between onsets (~240 BPM max)
        const last = this.onsets[this.onsets.length - 1];
        if (!last || (now - last) > 250) {
          this.onsets.push(now);
          if (this.onsets.length > 24) this.onsets.shift();
          this._calcBPM();
        }
      }

      this.prevEnergy = energy * 0.7 + this.prevEnergy * 0.3;
    }

    _calcBPM() {
      if (this.onsets.length < 4) return;

      // Compute inter-onset intervals
      const iois = [];
      for (let i = 1; i < this.onsets.length; i++) {
        iois.push(this.onsets[i] - this.onsets[i - 1]);
      }

      // Median filter
      const sorted = [...iois].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];

      if (med < 250 || med > 2500) return; // out of 24–240 BPM range

      const rawBPM = 60000 / med;

      // Exponential smoothing
      if (this.smoothedBPM === null) {
        this.smoothedBPM = rawBPM;
      } else {
        this.smoothedBPM = this.smoothedBPM * (1 - (this._smoothing||0.5)) + rawBPM * (this._smoothing||0.5);
      }

      const bpm = Math.round(this.smoothedBPM * 10) / 10;
      this.onBPM(bpm);
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
      if (this.engine) { this.engine.stop(); this.engine = null; }
      this.listening = false;
      const hadHistory = this._history.length >= 4;
      this.liveBPM = null;
      this._updateListenBtn();
      this._renderGauge(0);
      this._updateGraph();
      const lbl = this.el && this.el.querySelector('.pm-status-label');
      if (lbl) lbl.textContent = 'STOPPED';
      if (hadHistory) this._showDriftReport();
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

      // Update DOM
      this.el.querySelector('.pm-live-bpm').textContent = this.liveBPM.toFixed(1);
      const sign = delta >= 0 ? '+' : '';
      this.el.querySelector('.pm-delta').textContent = sign + delta.toFixed(1) + ' BPM';
      this.el.querySelector('.pm-status-label').textContent = status;
      this.el.querySelector('.pm-delta').className = 'pm-delta pm-delta--' + zone;
      this.el.querySelector('.pm-status-label').className = 'pm-status-label pm-status--' + zone;

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
      const clamped = Math.max(-range, Math.min(range, delta));
      const pct = clamped / range; // -1 to +1

      // Needle: rotate around center point
      const needleEl = svg.querySelector('.pm-needle');
      if (needleEl) {
        const angleDeg = pct * 140;
        // Use SVG transform attribute only — CSS transform fights it on Safari/iOS
        needleEl.setAttribute('transform', `rotate(${angleDeg}, 100, 100)`);
        needleEl.classList.toggle('pm-needle--pegged', Math.abs(delta) >= 10);
      }

      // Color based on delta
      const absDelta = Math.abs(delta);
      const color = absDelta <= 2 ? '#00ff88' : absDelta <= 5 ? '#ffcc00' : '#ff3b3b';

      // Right arc (rushing, pct > 0): path length = 125.66
      const arcRight = svg.querySelector('.pm-arc-right');
      if (arcRight) {
        if (pct > 0) {
          const len = pct * 125.66;
          arcRight.style.stroke = color;
          arcRight.setAttribute('stroke-dasharray', `${len} 999`);
          arcRight.setAttribute('stroke-dashoffset', '0');
        } else {
          arcRight.setAttribute('stroke-dasharray', '0 999');
        }
      }

      // Left arc (dragging, pct < 0): path drawn left-to-center, fill from end
      const arcLeft = svg.querySelector('.pm-arc-left');
      if (arcLeft) {
        if (pct < 0) {
          const len = Math.abs(pct) * 125.66;
          arcLeft.style.stroke = color;
          arcLeft.setAttribute('stroke-dasharray', `${len} 999`);
          arcLeft.setAttribute('stroke-dashoffset', `${125.66 - len}`);
        } else {
          arcLeft.setAttribute('stroke-dasharray', '0 999');
        }
      }

      // Clear both if in pocket
      if (absDelta < 1.0) {
        if (arcRight) arcRight.setAttribute('stroke-dasharray', '0 999');
        if (arcLeft) arcLeft.setAttribute('stroke-dasharray', '0 999');
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
      ring.style.borderColor = zone === 'green' ? '#00ff88' : zone === 'yellow' ? '#ffcc00' : '#ff3b3b';
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
      this.el.querySelector('.pm-tap-readout').textContent = 'TAP TEMPO';
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
      this.el.querySelector('.pm-tap-readout').textContent = 'TAP TEMPO';
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
      btn.textContent = this.listening ? '⏹ STOP' : '🎙 LISTEN';
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
    }

    // -- Calibration settings -----------------------------------------------------

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
      const panel = this.el.querySelector('.pm-settings-panel');
      const btn   = this.el.querySelector('.pm-settings-btn');
      if (!btn || !panel) return;
      btn.addEventListener('click', () => {
        panel.classList.toggle('pm-hidden');
        btn.style.opacity = panel.classList.contains('pm-hidden') ? '0.5' : '1';
      });
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
        if (btn) btn.textContent = '🏁 COUNT IN';
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
          if (btn) btn.textContent = '🏁 COUNT IN';
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

    _showDriftReport() {
      if (!this._history.length) return;
      const bpms = this._history.map(p => p.bpm), target = this.targetBPM;
      const avg = bpms.reduce((a,b)=>a+b,0)/bpms.length;
      const maxRush = Math.max(...bpms.map(b=>b-target));
      const maxDrag = Math.min(...bpms.map(b=>b-target));
      const pct = Math.round(bpms.filter(b=>Math.abs(b-target)<=2).length/bpms.length*100);
      const dur = Math.round(this._history[this._history.length-1].t/1000);
      this._history = []; this._historyStart = null;
      const report = this.el && this.el.querySelector('.pm-drift-report');
      const body   = this.el && this.el.querySelector('.pm-drift-body');
      if (!report || !body) return;
      const grade = pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴';
      body.innerHTML =
        '<div class="pm-drift-stat">' + grade + ' <span>' + pct + '%</span> in the pocket</div>' +
        '<div class="pm-drift-stat">🎯 Avg <span>' + avg.toFixed(1) + ' BPM</span> (target ' + target + ')</div>' +
        '<div class="pm-drift-stat">⏩ Max rush <span>+' + maxRush.toFixed(1) + '</span></div>' +
        '<div class="pm-drift-stat">⏪ Max drag <span>' + maxDrag.toFixed(1) + '</span></div>' +
        '<div class="pm-drift-stat">⏱ Duration <span>' + dur + 's</span></div>';
      report.classList.remove('pm-hidden');
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    _render() {
      const isGig = this.mode === 'gig';
      const div = document.createElement('div');
      div.className = `pm-root pm-mode-${this.mode}`;
      div.innerHTML = `
        <div class="pm-banner"></div>

        <div class="pm-flash-overlay"></div>

        <div class="pm-top-row">
          <div class="pm-label-sm">TARGET</div>
          <div class="pm-target-bpm">${this.targetBPM}</div>
          <div class="pm-label-sm">BPM</div>
          <button class="pm-settings-btn" title="Calibration">&#x2699;&#xFE0F;</button>
        </div>

        <div class="pm-toolbar">
          <button class="pm-mult-btn pm-mult--half">1/2x</button>
          <button class="pm-mult-btn pm-mult--1x pm-mult--active">1x</button>
          <button class="pm-mult-btn pm-mult--2x">2x</button>
          <span class="pm-toolbar-sep"></span>
          <button class="pm-sig-btn pm-sig--3">3/4</button>
          <button class="pm-sig-btn pm-sig--4 pm-sig--active">4/4</button>
          <button class="pm-sig-btn pm-sig--6">6/8</button>
          <span class="pm-toolbar-sep"></span>
          <button class="pm-flash-btn" title="Screen flash">&#x1F4A1;</button>
        </div>

        <div class="pm-settings-panel pm-hidden">
          <div class="pm-settings-title">&#x2699;&#xFE0F; CALIBRATION</div>
          <div class="pm-settings-row">
            <label class="pm-settings-label">SENSITIVITY</label>
            <div class="pm-settings-track">
              <span class="pm-settings-hint">Low</span>
              <input type="range" class="pm-cal-sensitivity" min="1" max="5" step="1" value="${this._getSetting('sensitivity','3')}" title="How easily beats are detected. If meter misses beats or reads erratically, move LEFT (less sensitive). If it triggers on non-beats or background noise, move RIGHT (more sensitive).">
              <span class="pm-settings-hint">High</span>
            </div>
            <div class="pm-settings-desc">Move LEFT if meter misses beats &bull; Move RIGHT if it triggers on noise</div>
          </div>
          <div class="pm-settings-row">
            <label class="pm-settings-label">REACTIVITY</label>
            <div class="pm-settings-track">
              <span class="pm-settings-hint">Smooth</span>
              <input type="range" class="pm-cal-reactivity" min="1" max="5" step="1" value="${this._getSetting('reactivity','3')}" title="How fast the BPM number reacts to tempo changes. Move RIGHT (snappy) if the number feels sluggish or slow to update. Move LEFT (smooth) if the number jumps around too much.">
              <span class="pm-settings-hint">Snappy</span>
            </div>
            <div class="pm-settings-desc">Move LEFT if number jumps too much &bull; Move RIGHT if it feels sluggish</div>
          </div>
          <div class="pm-settings-save">Adjustments apply instantly</div>
        </div>

        <div class="pm-gauge-wrap">
          <div class="pm-pulse-ring"></div>
          <svg class="pm-gauge-arc" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
            <!-- Background arc track -->
            <path class="pm-arc-track"
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linecap="round"/>
            <!-- Zone coloring: green center band -->
            <path class="pm-arc-zone-green"
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none" stroke="#00ff88" stroke-width="3" stroke-linecap="round"
              stroke-dasharray="28 999" stroke-dashoffset="-98"/>
            <!-- Active fill: right side (rushing) -->
            <path class="pm-arc-right"
              d="M 100 20 A 80 80 0 0 1 180 100"
              fill="none" stroke="#ff3b3b" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="0 999" stroke-dashoffset="0"/>
            <!-- Active fill: left side (dragging) -->
            <path class="pm-arc-left"
              d="M 20 100 A 80 80 0 0 1 100 20"
              fill="none" stroke="#ff3b3b" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="0 999" stroke-dashoffset="0"/>
            <!-- Tick marks -->
            <g class="pm-ticks" stroke="#333" stroke-width="1.5">
              <line x1="20"  y1="100" x2="24"  y2="100" transform="rotate(-140 100 100)"/>
              <line x1="20"  y1="100" x2="22"  y2="100" transform="rotate(-112 100 100)"/>
              <line x1="20"  y1="100" x2="24"  y2="100" transform="rotate(-84 100 100)"/>
              <line x1="20"  y1="100" x2="22"  y2="100" transform="rotate(-56 100 100)"/>
              <line x1="20"  y1="100" x2="26"  y2="100" transform="rotate(-28 100 100)"/>
              <!-- Center tick (target) -->
              <line x1="20"  y1="100" x2="27"  y2="100" stroke="#00ff88" stroke-width="2" transform="rotate(0 100 100)"/>
              <line x1="20"  y1="100" x2="22"  y2="100" transform="rotate(28 100 100)"/>
              <line x1="20"  y1="100" x2="24"  y2="100" transform="rotate(56 100 100)"/>
              <line x1="20"  y1="100" x2="22"  y2="100" transform="rotate(84 100 100)"/>
              <line x1="20"  y1="100" x2="24"  y2="100" transform="rotate(112 100 100)"/>
              <line x1="20"  y1="100" x2="24"  y2="100" transform="rotate(140 100 100)"/>
            </g>
            <!-- Slow / Fast labels -->
            <text x="18" y="98" font-family="monospace" font-size="9" fill="#888" text-anchor="middle" font-weight="700">−10</text>
            <text x="182" y="98" font-family="monospace" font-size="9" fill="#888" text-anchor="middle" font-weight="700">+10</text>
            <!-- Needle pivot dot -->
            <circle cx="100" cy="100" r="5" fill="#555"/>
            <!-- Needle (rotated around 100,100) -->
            <g class="pm-needle">
              <line x1="100" y1="100" x2="100" y2="28" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
              <circle cx="100" cy="100" r="3" fill="#fff"/>
            </g>
          </svg>

          <div class="pm-center-readout">
            <div class="pm-live-label">LIVE BPM</div>
            <div class="pm-live-bpm">--.-</div>
            <div class="pm-delta pm-delta--green" title="Difference from target BPM">±0.0</div>
          </div>
        </div>

        <div class="pm-status-label pm-status--green">STANDBY</div>

        <div class="pm-controls">
          <button class="pm-listen-btn">🎙 LISTEN</button>
          <button class="pm-tap-btn">TAP</button>
        </div>

        <div class="pm-tap-zone">
          <div class="pm-tap-readout">TAP TEMPO</div>
          <div class="pm-action-row">
            <button class="pm-broadcast-btn pm-hidden">📡 BROADCAST</button>
            <button class="pm-lock-btn pm-hidden">💾 LOCK</button>
          </div>
          <button class="pm-countin-btn">🏁 COUNT IN</button>
        </div>

        <div class="pm-graph-section">
          <div class="pm-graph-label">TEMPO HISTORY</div>
          <svg class="pm-history-graph" viewBox="0 0 280 60" preserveAspectRatio="none">
            <line class="pm-graph-target-line" x1="0" y1="30" x2="280" y2="30" stroke="#00ff88" stroke-width="0.5" stroke-dasharray="4 4" opacity="0.4"/>
            <polyline class="pm-graph-line" points="" fill="none" stroke="#00ff88" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="pm-drift-report pm-hidden">
          <div class="pm-drift-title">📊 SESSION REPORT</div>
          <div class="pm-drift-body"></div>
          <button class="pm-drift-close">× DISMISS</button>
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
        /* ── Pocket Meter Root ── */
        .pm-root {
          --pm-bg:       #0a0a0a;
          --pm-surface:  #111;
          --pm-border:   #222;
          --pm-green:    #00ff88;
          --pm-yellow:   #ffcc00;
          --pm-red:      #ff3b3b;
          --pm-text:     #e0e0e0;
          --pm-dim:      #555;
          --pm-mono:     'Courier New', 'Lucida Console', monospace;

          background: var(--pm-bg);
          border: 1px solid var(--pm-border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
          user-select: none;
          box-shadow: 0 0 30px rgba(0,255,136,0.03), inset 0 1px 0 #1e1e1e;
          max-width: 320px;
          width: 100%;
          margin: 0 auto;
          font-family: var(--pm-mono);
        }

        /* Gig mode: bigger, more dramatic */
        .pm-mode-gig {
          max-width: 400px;
          padding: 20px;
          border-color: #1a1a1a;
          background: #050505;
          box-shadow: 0 0 60px rgba(0,255,136,0.05);
        }

        /* ── Banner ── */
        .pm-banner {
          position: absolute;
          top: 0; left: 0; right: 0;
          background: #1a2a1a;
          color: var(--pm-green);
          font-size: 11px;
          letter-spacing: 0.05em;
          text-align: center;
          padding: 6px;
          transform: translateY(-100%);
          transition: transform 0.25s ease;
          z-index: 10;
          border-bottom: 1px solid #1e3a1e;
        }
        .pm-banner--show { transform: translateY(0); }

        /* ── Top row ── */
        .pm-top-row {
          display: flex;
          align-items: baseline;
          gap: 4px;
          color: var(--pm-dim);
        }
        .pm-label-sm {
          font-size: 9px;
          letter-spacing: 0.15em;
          color: var(--pm-dim);
        }
        .pm-target-bpm {
          font-size: 28px;
          color: var(--pm-text);
          line-height: 1;
          letter-spacing: -0.02em;
        }
        .pm-mode-gig .pm-target-bpm { font-size: 36px; }

        /* ── Gauge wrapper ── */
        .pm-gauge-wrap {
          position: relative;
          width: 100%;
          max-width: 240px;
        }
        .pm-mode-gig .pm-gauge-wrap { max-width: 300px; }

        .pm-gauge-arc {
          width: 100%;
          height: auto;
          display: block;
        }

        /* ── Pulse ring (gig mode beat flash) ── */
        .pm-pulse-ring {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid transparent;
          pointer-events: none;
        }
        @keyframes pm-pulse {
          0%   { opacity: 0.9; transform: scale(0.97); }
          60%  { opacity: 0.2; transform: scale(1.04); }
          100% { opacity: 0;   transform: scale(1.07); }
        }
        .pm-pulse-anim { animation: pm-pulse 0.35s ease-out forwards; }

        /* ── Center readout ── */
        .pm-center-readout {
          position: absolute;
          bottom: 0; left: 50%;
          transform: translateX(-50%) translateY(-6px);
          text-align: center;
          line-height: 1;
        }
        .pm-live-label {
          font-size: 8px;
          letter-spacing: 0.18em;
          color: var(--pm-dim);
          margin-bottom: 2px;
        }
        .pm-live-bpm {
          font-size: 36px;
          color: var(--pm-text);
          letter-spacing: -0.03em;
        }
        .pm-mode-gig .pm-live-bpm { font-size: 48px; }
        .pm-delta {
          font-size: 15px;
          letter-spacing: 0.05em;
          margin-top: 2px;
        }
        .pm-mode-gig .pm-delta { font-size: 18px; }
        .pm-delta--green { color: var(--pm-green); }
        .pm-delta--yellow { color: var(--pm-yellow); }
        .pm-delta--red   { color: var(--pm-red); }

        /* ── Status label ── */
        .pm-status-label {
          font-size: 13px;
          letter-spacing: 0.25em;
          font-weight: bold;
          margin-top: 4px;
          transition: color 0.3s;
          min-height: 1.4em;
          text-align: center;
        }
        .pm-mode-gig .pm-status-label { font-size: 16px; }
        .pm-status--green  { color: var(--pm-green); text-shadow: 0 0 10px rgba(0,255,136,0.5); }
        .pm-status--yellow { color: var(--pm-yellow); text-shadow: 0 0 10px rgba(255,204,0,0.4); }
        .pm-status--red    { color: var(--pm-red);    text-shadow: 0 0 10px rgba(255,59,59,0.5); }

        /* ── Controls ── */
        .pm-controls {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          width: 100%;
        }
        .pm-controls button {
          flex: 1;
          padding: 8px 4px;
          background: #141414;
          border: 1px solid var(--pm-border);
          color: var(--pm-text);
          font-family: var(--pm-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .pm-controls button:hover { background: #1a1a1a; border-color: #333; }
        .pm-controls button:active { transform: scale(0.97); }

        .pm-listen-btn.pm-listen--active {
          border-color: var(--pm-red);
          color: var(--pm-red);
          box-shadow: 0 0 8px rgba(255,59,59,0.2);
        }
        .pm-tap-btn { touch-action: manipulation; }
        @keyframes pm-tap-f {
          0%   { background: #00ff8820; }
          100% { background: #141414; }
        }
        .pm-tap-flash { animation: pm-tap-f 0.1s ease-out forwards; }

        /* ── Tap zone ── */
        .pm-tap-zone {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .pm-tap-readout {
          font-size: 18px;
          color: var(--pm-yellow);
          letter-spacing: 0.05em;
          min-height: 1.4em;
          text-align: center;
        }
        .pm-mode-gig .pm-tap-readout { font-size: 22px; }

        .pm-action-row {
          display: flex;
          gap: 6px;
          width: 100%;
        }
        .pm-action-row button {
          flex: 1;
          padding: 9px 4px;
          font-family: var(--pm-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s;
          border: 1px solid;
        }
        .pm-action-row button:active { transform: scale(0.97); }

        .pm-broadcast-btn {
          background: #0a1a10;
          border-color: #00aa55 !important;
          color: var(--pm-green);
        }
        .pm-broadcast-btn:hover { background: #0f2218; box-shadow: 0 0 10px rgba(0,255,136,0.15); }

        .pm-lock-btn {
          background: #1a1500;
          border-color: #997700 !important;
          color: var(--pm-yellow);
        }
        .pm-lock-btn:hover { background: #221c00; box-shadow: 0 0 10px rgba(255,204,0,0.15); }

        .pm-hidden { display: none !important; }

        /* Flash overlay */
        .pm-flash-overlay { position:absolute; inset:0; border-radius:16px; pointer-events:none; z-index:10; opacity:0; transition:opacity 0.05s; }
        .pm-root { position:relative; }
        /* Toolbar */
        .pm-toolbar { display:flex; align-items:center; justify-content:center; gap:4px; padding:6px 8px; margin:4px 0; background:#0a0a0a; border-radius:8px; border:1px solid #1a1a1a; }
        .pm-mult-btn, .pm-sig-btn { background:#111; border:1px solid #2a2a2a; color:#555; font-family:monospace; font-size:0.7em; font-weight:700; padding:3px 8px; border-radius:5px; cursor:pointer; letter-spacing:0.05em; transition:all 0.15s; }
        .pm-mult-btn:hover, .pm-sig-btn:hover { color:#888; border-color:#444; }
        .pm-mult--active, .pm-sig--active { background:#0d2a1a !important; border-color:#00ff88 !important; color:#00ff88 !important; }
        .pm-toolbar-sep { width:1px; height:16px; background:#222; margin:0 2px; }
        .pm-flash-btn { background:#111; border:1px solid #2a2a2a; font-size:0.85em; padding:3px 7px; border-radius:5px; cursor:pointer; transition:all 0.15s; opacity:0.5; }
        .pm-flash-btn--active { opacity:1 !important; border-color:#ffcc00 !important; }
        .pm-needle--pegged line { stroke:#ff3b3b !important; animation:pm-peg-pulse 0.4s ease-in-out infinite alternate; }
        @keyframes pm-peg-pulse { from { opacity:1; } to { opacity:0.4; } }
        .pm-settings-desc { font-size:0.58em; color:#3a3a3a; letter-spacing:0.04em; margin-top:4px; line-height:1.4; }
        /* Count-in */
        .pm-countin-btn { width:100%; margin-top:8px; padding:8px; border-radius:8px; background:#0d2a1a; border:1px solid rgba(0,255,136,0.25); color:#00ff88; font-family:monospace; font-size:0.72em; font-weight:700; letter-spacing:0.08em; cursor:pointer; transition:all 0.2s; }
        .pm-countin-btn:hover { background:#0d3a1a; border-color:#00ff88; }
        /* Gear */
        .pm-settings-btn { position:absolute; right:0; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; font-size:1em; opacity:0.5; padding:2px 4px; transition:opacity 0.2s; }
        .pm-settings-btn:hover { opacity:1; }
        .pm-top-row { position:relative; }
        /* Settings panel */
        .pm-settings-panel { background:#0d0d0d; border:1px solid #222; border-radius:10px; padding:12px 16px; margin:0 4px 8px; font-family:monospace; }
        .pm-settings-title { font-size:0.65em; color:#555; letter-spacing:0.1em; font-weight:700; margin-bottom:12px; text-align:center; }
        .pm-settings-row { margin-bottom:12px; }
        .pm-settings-label { display:block; font-size:0.6em; color:#555; letter-spacing:0.08em; font-weight:700; margin-bottom:6px; }
        .pm-settings-track { display:flex; align-items:center; gap:8px; }
        .pm-settings-hint { font-size:0.6em; color:#444; min-width:36px; letter-spacing:0.05em; }
        .pm-settings-track input[type=range] { flex:1; -webkit-appearance:none; height:3px; background:linear-gradient(to right,#1a3a2a,#00ff88); border-radius:2px; outline:none; }
        .pm-settings-track input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:#00ff88; cursor:pointer; border:2px solid #030305; box-shadow:0 0 6px rgba(0,255,136,0.4); }
        .pm-settings-save { font-size:0.58em; color:#333; text-align:center; letter-spacing:0.06em; }
        /* History graph */
        .pm-graph-section { margin:8px 4px 4px; background:#050505; border:1px solid #1a1a1a; border-radius:8px; padding:6px 8px; }
        .pm-graph-label { font-family:monospace; font-size:0.55em; color:#333; letter-spacing:0.1em; margin-bottom:4px; }
        .pm-history-graph { width:100%; height:60px; display:block; }
        /* Drift report */
        .pm-drift-report { margin:8px 4px; background:#0a0f0a; border:1px solid rgba(0,255,136,0.18); border-radius:10px; padding:12px 14px; }
        .pm-drift-title { font-family:monospace; font-size:0.65em; color:#00ff88; letter-spacing:0.1em; font-weight:700; margin-bottom:10px; text-align:center; }
        .pm-drift-stat { font-family:monospace; font-size:0.68em; color:#555; padding:4px 0; border-bottom:1px solid #111; letter-spacing:0.04em; }
        .pm-drift-stat span { color:#ccc; float:right; }
        .pm-drift-close { width:100%; margin-top:10px; padding:6px; border-radius:6px; background:#111; border:1px solid #222; color:#444; font-family:monospace; font-size:0.65em; cursor:pointer; letter-spacing:0.06em; }
        .pm-drift-close:hover { color:#888; border-color:#444; }

        /* ── Scanline texture overlay ── */
        .pm-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.08) 2px,
            rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }
        .pm-root > * { position: relative; z-index: 1; }

        /* ── Gig mode: glowing edge ── */
        .pm-mode-gig::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 12px;
          box-shadow: inset 0 0 40px rgba(0,255,136,0.03);
          pointer-events: none;
        }
      `;
      document.head.appendChild(s);
    }
  }

  // Export
  global.PocketMeter = PocketMeter;

})(window);
