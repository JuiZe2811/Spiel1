// Komplett synthetisiertes Sounddesign über die Web Audio API (keine Audiodateien nötig).
import { clamp, rand } from './util.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.scareScale = 1;
    this.threat = 0;
    this.heartT = 0;
    this.ambT = 3;
    this.pulseT = 0;
  }

  get ready() { return !!this.ctx; }

  // Muss direkt aus einem Klick/Tipp aufgerufen werden (iOS/Android-Autoplay-Regeln).
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* nicht unterstützt */ }
    if (!this.ctx) {
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { this.ctx = new AC(); }
      this._setup();
    }
    // Stiller Puffer entsperrt Audio auf älteren iOS-Versionen.
    try {
      const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    } catch { /* egal */ }
    this.resume();
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  _setup() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);

    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const bd = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }

    // Umgebung: tiefes Rumpeln, Wind, schwebender Bordun
    const rumble = this._loop(this.brown); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const rg = c.createGain(); rg.gain.value = 0.5; rumble.connect(lp).connect(rg).connect(this.amb);
    const wind = this._loop(this.noise); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0.05; wind.connect(bp).connect(wg).connect(this.amb);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.04; lfo.connect(lg).connect(wg.gain); lfo.start();
    for (const f of [41, 43.6, 82.5]) {
      const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.05;
      o.connect(g).connect(this.amb); o.start();
    }

    // Verfolgungsmusik: dissonante Streicherflächen mit Tremolo
    const strings = c.createGain(); strings.gain.value = 0.35;
    const slp = c.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 900;
    strings.connect(slp).connect(this.music);
    for (const f of [73.4, 77.8, 146.8, 155.6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-8, 8);
      const g = c.createGain(); g.gain.value = 0.12; o.connect(g).connect(strings); o.start();
    }
    const trem = c.createOscillator(); trem.frequency.value = 7; const tg = c.createGain(); tg.gain.value = 0.15;
    trem.connect(tg).connect(strings.gain); trem.start();
    for (const f of [1174, 1244]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const vib = c.createOscillator(); vib.frequency.value = 5.5; const vg = c.createGain(); vg.gain.value = 12; vib.connect(vg).connect(o.frequency); vib.start();
      const g = c.createGain(); g.gain.value = 0.025; o.connect(g).connect(this.music); o.start();
    }

    // Stimme des echten Geistes (räumlich)
    this.ghostPan = this._panner(0, 1.5, 0);
    this.ghostGain = c.createGain(); this.ghostGain.gain.value = 0;
    this.ghostGain.connect(this.ghostPan).connect(this.sfx);
    const gv = this._loop(this.noise); const gbp = c.createBiquadFilter(); gbp.type = 'bandpass'; gbp.frequency.value = 420; gbp.Q.value = 4;
    const gvg = c.createGain(); gvg.gain.value = 0.5; gv.connect(gbp).connect(gvg).connect(this.ghostGain);
    const glfo = c.createOscillator(); glfo.frequency.value = 0.6; const glg = c.createGain(); glg.gain.value = 180; glfo.connect(glg).connect(gbp.frequency); glfo.start();
    const go = c.createOscillator(); go.type = 'triangle'; go.frequency.value = 96;
    const gvib = c.createOscillator(); gvib.frequency.value = 4.3; const gvibg = c.createGain(); gvibg.gain.value = 5; gvib.connect(gvibg).connect(go.frequency); gvib.start();
    const gog = c.createGain(); gog.gain.value = 0.18; go.connect(gog).connect(this.ghostGain); go.start();

    this.amb.gain.setTargetAtTime(1, c.currentTime, 1.5);
  }

  _loop(buffer) { const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true; s.loopStart = 0; s.start(0, Math.random() * 1.5); return s; }

  _panner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 1.5; p.maxDistance = 50; p.rolloffFactor = 1.3;
    this._setPos(p, x, y, z);
    return p;
  }
  _setPos(p, x, y, z) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
    if (p.positionX) { const t = this.ctx.currentTime; p.positionX.setValueAtTime(x, t); p.positionY.setValueAtTime(y, t); p.positionZ.setValueAtTime(z, t); }
    else p.setPosition(x, y, z);
  }
  _dest(pos) {
    if (!pos) return this.sfx;
    const p = this._panner(pos.x, pos.y ?? 1.4, pos.z); p.connect(this.sfx);
    return p;
  }

  updateListener(cam, fx, fz) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    const x = cam.position.x, y = cam.position.y, z = cam.position.z;
    if (![x, y, z, fx, fz].every(Number.isFinite)) return;
    this.lx = x; this.lz = z;
    if (L.positionX) {
      L.positionX.setValueAtTime(x, t); L.positionY.setValueAtTime(y, t); L.positionZ.setValueAtTime(z, t);
      L.forwardX.setValueAtTime(fx, t); L.forwardY.setValueAtTime(0, t); L.forwardZ.setValueAtTime(fz, t);
      L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
    } else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  // ---------- Bausteine ----------
  _noise({ dur = 0.2, type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, pos = null, buffer = null, freqEnd = null, when = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = buffer || this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this._dest(pos));
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.5, gain = 0.3, attack = 0.01, pos = null, when = 0, vib = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    if (vib) { const v = c.createOscillator(); v.frequency.value = 6; const vg = c.createGain(); vg.gain.value = vib; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + dur + 0.05); }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._dest(pos));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- Effekte ----------
  footstep(zone, intensity) {
    const f = { c: 1700, l: 1500, o: 450, s: 900, k: 650 }[zone] || 900;
    this._noise({ dur: 0.07 + intensity * 0.05, freq: f * rand(0.85, 1.15), q: 1.2, gain: 0.07 + intensity * 0.22 });
    this._noise({ dur: 0.09, type: 'lowpass', freq: 220, gain: 0.08 + intensity * 0.18 });
    if (zone === 'k' && Math.random() < 0.4) this._noise({ dur: 0.15, type: 'highpass', freq: 3000, gain: 0.04 + intensity * 0.05, when: 0.02 });
  }
  ghostStep(pos) { this._noise({ dur: 0.08, freq: 600, q: 1, gain: 0.25, pos }); }
  doorOpen(pos) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(70, 110), t);
    for (let i = 1; i < 8; i++) o.frequency.setValueAtTime(rand(60, 190), t + i * 0.09);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f).connect(g).connect(this._dest(pos)); o.start(t); o.stop(t + 0.85);
  }
  doorClose(pos) { this._noise({ dur: 0.25, type: 'lowpass', freq: 900, gain: 0.5, pos }); this._tone({ freq: 70, freqEnd: 45, dur: 0.25, gain: 0.4, pos }); }
  doorSlam(pos) {
    const k = this.scareScale;
    this._noise({ dur: 0.5, type: 'lowpass', freq: 2200, freqEnd: 300, gain: 1.0 * k, pos });
    this._tone({ freq: 80, freqEnd: 35, dur: 0.5, gain: 0.9 * k, pos });
    this._noise({ dur: 0.35, freq: 3000, q: 3, gain: 0.25 * k, pos, when: 0.06 });
  }
  whisper(pos) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, dur = rand(1.4, 2.2);
    const dst = this._dest(pos);
    for (const [fc, gmax] of [[rand(2000, 3200), 0.5], [rand(900, 1300), 0.3]]) {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 3;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      let tt = t;
      while (tt < t + dur) {
        const syl = rand(0.08, 0.22);
        g.gain.linearRampToValueAtTime(gmax * rand(0.4, 1) * this.scareScale, tt + syl * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, tt + syl);
        f.frequency.setValueAtTime(fc * rand(0.7, 1.3), tt);
        tt += syl + rand(0, 0.08);
      }
      s.connect(f).connect(g).connect(dst); s.start(t, Math.random()); s.stop(t + dur + 0.1);
    }
  }
  moan(pos, gain = 0.4) {
    const f = rand(120, 170);
    this._tone({ freq: f, freqEnd: f * 0.6, type: 'triangle', dur: 2.2, gain: gain * this.scareScale, attack: 0.4, pos, vib: 8 });
    this._tone({ freq: f * 1.5, freqEnd: f * 0.85, type: 'sine', dur: 2.0, gain: gain * 0.5 * this.scareScale, attack: 0.5, pos, vib: 10 });
  }
  whoosh(pos) { this._noise({ dur: 0.6, freq: 400, freqEnd: 2500, q: 2, gain: 0.45 * this.scareScale, attack: 0.15, pos }); }
  stinger(strength = 1) {
    const k = strength * this.scareScale;
    for (const f of [220, 233, 311, 330, 466, 494]) this._tone({ freq: f, freqEnd: f * 0.8, type: 'sawtooth', dur: 1.4, gain: 0.09 * k, attack: 0.01 });
    this._noise({ dur: 0.9, type: 'highpass', freq: 1500, gain: 0.5 * k, attack: 0.005 });
    this._tone({ freq: 60, freqEnd: 30, dur: 0.8, gain: 0.8 * k });
  }
  scream(strength = 1) {
    const k = strength * this.scareScale;
    this._tone({ freq: 900, freqEnd: 520, type: 'sawtooth', dur: 1.3, gain: 0.25 * k, attack: 0.02, vib: 60 });
    this._tone({ freq: 1340, freqEnd: 760, type: 'square', dur: 1.1, gain: 0.08 * k, attack: 0.02, vib: 80 });
    this._noise({ dur: 1.3, freq: 2500, q: 0.8, gain: 0.6 * k });
    this._tone({ freq: 55, freqEnd: 30, dur: 1.2, gain: 0.9 * k });
  }
  knock(pos) { for (let i = 0; i < 3; i++) this._noise({ dur: 0.08, type: 'lowpass', freq: 700, gain: 0.6, pos, when: i * 0.22 }); }
  scrape(pos) { this._noise({ dur: 0.7, freq: 600, freqEnd: 1400, q: 5, gain: 0.45, attack: 0.05, pos }); this._noise({ dur: 0.2, type: 'lowpass', freq: 400, gain: 0.6, pos, when: 0.65 }); }
  runSteps(pos, count = 6) { for (let i = 0; i < count; i++) this._noise({ dur: 0.07, freq: 800, gain: 0.35, pos, when: i * 0.15 }); }
  keyPickup() {
    [988, 1319, 1976].forEach((f, i) => this._tone({ freq: f, dur: 0.9, gain: 0.18, when: i * 0.08 }));
  }
  unlockExit() {
    this._tone({ freq: 90, freqEnd: 40, dur: 0.6, gain: 0.8 });
    this._noise({ dur: 0.4, type: 'lowpass', freq: 1500, gain: 0.6 });
    [523, 659, 784].forEach((f, i) => this._tone({ freq: f, dur: 1.5, gain: 0.12, when: 0.3 + i * 0.1 }));
  }
  crucifix() {
    [392, 494, 587, 784].forEach((f, i) => this._tone({ freq: f, dur: 2.2, gain: 0.09, attack: 0.05, when: i * 0.03, vib: 4 }));
    this._noise({ dur: 0.8, freq: 3000, freqEnd: 600, q: 1, gain: 0.3, attack: 0.02 });
  }
  ghostShriek(pos) { this._tone({ freq: 700, freqEnd: 200, type: 'sawtooth', dur: 1.0, gain: 0.3, pos, vib: 40 }); this._noise({ dur: 0.8, freq: 1800, gain: 0.3, pos }); }
  breath() { this._noise({ dur: 0.6, freq: 700, q: 0.8, gain: 0.08, attack: 0.25 }); }
  click() { this._noise({ dur: 0.03, type: 'highpass', freq: 2500, gain: 0.25 }); }
  heartbeat(strength) {
    this._tone({ freq: 58, freqEnd: 40, dur: 0.18, gain: 0.5 * strength });
    this._tone({ freq: 52, freqEnd: 36, dur: 0.2, gain: 0.4 * strength, when: 0.22 });
  }
  win() { [262, 330, 392, 523].forEach((f, i) => this._tone({ freq: f, dur: 2.5, gain: 0.12, when: i * 0.15, attack: 0.1 })); }

  // ---------- Zusätzliche Schreck-Geräusche ----------
  phoneRing(pos) {
    for (let r = 0; r < 3; r++) for (const f of [440, 480]) {
      for (let i = 0; i < 10; i++) this._tone({ freq: f, type: 'square', dur: 0.05, gain: 0.05, attack: 0.005, pos, when: r * 1.6 + i * 0.05 });
    }
  }
  giggle(pos) {
    const base = rand(600, 760);
    for (let i = 0; i < 6; i++) this._tone({ freq: base * rand(0.95, 1.1), freqEnd: base * 0.8, type: 'triangle', dur: 0.12, gain: 0.22 * this.scareScale, attack: 0.01, pos, when: i * 0.14, vib: 20 });
  }
  bang(pos, strength = 1) {
    const k = strength * this.scareScale;
    this._noise({ dur: 0.18, type: 'lowpass', freq: 500, gain: 0.9 * k, attack: 0.003, pos });
    this._tone({ freq: 70, freqEnd: 40, dur: 0.2, gain: 0.8 * k, pos });
  }
  distantScream(pos) {
    this._tone({ freq: 800, freqEnd: 420, type: 'sawtooth', dur: 1.6, gain: 0.35 * this.scareScale, attack: 0.08, pos, vib: 45 });
    this._noise({ dur: 1.4, freq: 1800, q: 1, gain: 0.3 * this.scareScale, attack: 0.1, pos });
  }
  stepsAt(points, interval) {
    points.forEach((p, i) => {
      this._noise({ dur: 0.08, freq: 900, gain: 0.35 + i * 0.06, pos: p, when: i * interval });
      this._noise({ dur: 0.1, type: 'lowpass', freq: 200, gain: 0.3 + i * 0.05, pos: p, when: i * interval });
    });
  }
  huntSiren() {
    const k = this.scareScale;
    this._tone({ freq: 55, freqEnd: 50, type: 'sawtooth', dur: 3.5, gain: 0.35 * k, attack: 0.6 });
    this._tone({ freq: 58, freqEnd: 52, type: 'sawtooth', dur: 3.5, gain: 0.3 * k, attack: 0.6 });
    this._tone({ freq: 1600, freqEnd: 400, type: 'sine', dur: 2.5, gain: 0.08 * k, attack: 0.3, vib: 30 });
    this._noise({ dur: 2.5, freq: 300, freqEnd: 3000, q: 2, gain: 0.25 * k, attack: 1.2 });
  }

  setGhost(pos, intensity) {
    if (!this.ctx) return;
    this._setPos(this.ghostPan, pos.x, 1.5, pos.z);
    this.ghostGain.gain.setTargetAtTime(intensity, this.ctx.currentTime, 0.2);
  }

  setThreat(t) { this.threat = t; if (this.ctx) this.music.gain.setTargetAtTime(clamp(t, 0, 1) * 0.55, this.ctx.currentTime, 0.6); }

  silenceGame() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(0, t, 0.3);
    this.ghostGain.gain.setTargetAtTime(0, t, 0.2);
  }

  update(dt, inKeller) {
    if (!this.ctx) return;
    if (this.threat > 0.25) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartbeat(clamp(this.threat, 0.3, 1)); this.heartT = 1.1 - this.threat * 0.55; }
    }
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = rand(4, 11);
      const p = { x: (this.lx || 0) + rand(-12, 12), y: 2.5, z: (this.lz || 0) + rand(-12, 12) };
      const r = Math.random();
      if (inKeller || r < 0.3) this._tone({ freq: rand(1800, 2600), freqEnd: 900, dur: 0.12, gain: 0.08, pos: p });
      else if (r < 0.6) this._tone({ freq: rand(60, 90), type: 'sawtooth', dur: 1.2, gain: 0.05, attack: 0.3, pos: p });
      else this._noise({ dur: 0.3, type: 'lowpass', freq: 500, gain: 0.15, pos: p });
    }
  }
}
