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
    if (this.scareBus) this.scareBus.gain.setTargetAtTime(1.8 * v, this.ctx.currentTime, 0.05);
  }

  _setup() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    this.master.connect(comp).connect(limiter).connect(c.destination);
    this.limiter = limiter;
    // Eigener, lauter Kanal für Schocks (am Kompressor vorbei, nur vom Limiter begrenzt)
    this.scareBus = c.createGain(); this.scareBus.gain.value = 1.8 * this.volume;
    this.scareBus.connect(limiter);
    // Musik und Umgebung werden bei Schocks kurz abgesenkt, damit der Schrei durchschlägt
    this.duckNode = c.createGain(); this.duckNode.connect(this.master);
    // Hall: synthetische Impulsantwort eines großen, leeren Gebäudes
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(2.4, 3);
    this.verbSend = c.createGain(); this.verbSend.gain.value = 0.45;
    this.verbSend.connect(this.verb).connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master); this.sfx.connect(this.verbSend);
    this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.duckNode);
    this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.duckNode);
    this.scareBus.connect(this.verbSend);
    const ambVerb = c.createGain(); ambVerb.gain.value = 0.5; this.amb.connect(ambVerb).connect(this.verbSend);
    // Verzerrung für Schreie
    this.distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1, k = 60; this.distCurve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x)); }

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
    // Unheimliche, sich langsam verändernde Fläche (dissonante Sägezähne hinter einem wandernden Filter)
    const pad = c.createGain(); pad.gain.value = 0.05;
    const plp = c.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 380; plp.Q.value = 6;
    const plfo = c.createOscillator(); plfo.frequency.value = 0.035; const plg = c.createGain(); plg.gain.value = 260; plfo.connect(plg).connect(plp.frequency); plfo.start();
    for (const f of [55, 58.3, 82.4, 87.3, 116.5]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-12, 12);
      o.connect(pad); o.start();
    }
    pad.connect(plp).connect(this.amb);
    // Heulender Wind durch die Ritzen
    const howl = this._loop(this.noise); const hbp = c.createBiquadFilter(); hbp.type = 'bandpass'; hbp.frequency.value = 700; hbp.Q.value = 12;
    const hg = c.createGain(); hg.gain.value = 0.0;
    const hlfo = c.createOscillator(); hlfo.frequency.value = 0.05; const hlg = c.createGain(); hlg.gain.value = 450; hlfo.connect(hlg).connect(hbp.frequency); hlfo.start();
    const hlfo2 = c.createOscillator(); hlfo2.frequency.value = 0.09; const hlg2 = c.createGain(); hlg2.gain.value = 0.06; hlfo2.connect(hlg2).connect(hg.gain); hlfo2.start();
    howl.connect(hbp).connect(hg).connect(this.amb);

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
    const gvg = this.ghostSynth = c.createGain(); gvg.gain.value = 0.5; gv.connect(gbp).connect(gvg).connect(this.ghostGain);
    const glfo = c.createOscillator(); glfo.frequency.value = 0.6; const glg = c.createGain(); glg.gain.value = 180; glfo.connect(glg).connect(gbp.frequency); glfo.start();
    const go = c.createOscillator(); go.type = 'triangle'; go.frequency.value = 96;
    const gvib = c.createOscillator(); gvib.frequency.value = 4.3; const gvibg = c.createGain(); gvibg.gain.value = 5; gvib.connect(gvibg).connect(go.frequency); gvib.start();
    const gog = c.createGain(); gog.gain.value = 0.18; go.connect(gog).connect(this.ghostGain); go.start();

    // Hintergrundmusik (Aufnahme), läuft über das Ducking wie die Umgebung
    this.bed = c.createGain(); this.bed.gain.value = 0; this.bed.connect(this.duckNode);
    this.bedLevel = 0.5;
    this.amb.gain.setTargetAtTime(1, c.currentTime, 1.5);
    this.loadSamples();
  }

  // ---------- Aufgenommene Sounds (assets/audio) ----------
  loadSamples() {
    if (this.samplesLoading) return;
    this.samplesLoading = true;
    this.samples = {};
    const files = { kreischen: 'kreischen.mp3', maedchen: 'maedchen-schrei.mp3', atem: 'geist-atem.mp3', stimmen: 'stimmen.mp3', musik: 'musik.mp3' };
    for (const [name, file] of Object.entries(files)) {
      fetch(`assets/audio/${file}`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((buf) => new Promise((res, rej) => this.ctx.decodeAudioData(buf, res, rej)))
        .then((audio) => { this.samples[name] = audio; this._onSample(name); })
        .catch(() => { /* Datei fehlt: synthetischer Ersatz bleibt aktiv */ });
    }
  }

  _onSample(name) {
    const c = this.ctx;
    if (name === 'atem') {
      // Atmen/Knurren des Geistes als räumliche Dauerschleife
      const src = c.createBufferSource(); src.buffer = this.samples.atem; src.loop = true;
      const g = c.createGain(); g.gain.value = 1.4;
      src.connect(g).connect(this.ghostGain); src.start();
      this.ghostSynth.gain.setTargetAtTime(0.15, c.currentTime, 0.5);
    }
    if (name === 'musik') {
      const src = c.createBufferSource(); src.buffer = this.samples.musik; src.loop = true;
      src.connect(this.bed); src.start();
      this.bed.gain.setTargetAtTime(this.bedLevel, c.currentTime, 2);
    }
  }

  // Spielt eine Aufnahme ab (optional räumlich, Teilstück, Tonhöhe)
  sample(name, { gain = 1, pos = null, rate = 1, offset = 0, duration = null, when = 0, fadeOut = 0.15 } = {}) {
    const buf = this.samples && this.samples[name];
    if (!this.ctx || !buf) return false;
    const c = this.ctx, t = c.currentTime + when;
    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t);
    const len = duration ?? (buf.duration - offset) / rate;
    if (duration) { g.gain.setValueAtTime(gain, t + Math.max(0, len - fadeOut)); g.gain.linearRampToValueAtTime(0.0001, t + len); }
    src.connect(g).connect(this._dest(pos));
    src.start(t, offset, duration ? duration * rate : undefined);
    return true;
  }

  // Lautstärke der Hintergrundmusik: Menü lauter, im Spiel leise, bei Verfolgung fast weg
  setBed(level) {
    this.bedLevel = level;
    if (this.bed) this.bed.gain.setTargetAtTime(level, this.ctx.currentTime, 1.2);
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
    const bus = this._bus || this.sfx;
    if (!pos) return bus;
    const p = this._panner(pos.x, pos.y ?? 1.4, pos.z); p.connect(bus);
    return p;
  }

  // Alles in fn() läuft über den lauten Schock-Kanal; Musik und Umgebung werden kurz abgesenkt.
  _loud(fn, duckSec = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = this.duckNode.gain;
    d.cancelScheduledValues(t); d.setTargetAtTime(0.12, t, 0.015); d.setTargetAtTime(1, t + duckSec, 0.5);
    this._bus = this.scareBus;
    try { fn(); } finally { this._bus = null; }
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

  _impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // Menschlich klingender Schrei: mehrere Stimmen durch Vokal-Formanten, Rauheit, Verzerrung.
  _scream({ base = 950, dur = 1.4, gain = 0.8, pos = null, when = 0, rough = 1 }) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + 0.035);
    out.gain.setValueAtTime(gain, t + dur * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const shaper = c.createWaveShaper(); shaper.curve = this.distCurve; shaper.oversample = '2x';
    const formants = c.createGain();
    for (const [f, q, g] of [[850, 6, 1], [1250, 7, 0.7], [2900, 9, 0.45], [3700, 10, 0.25]]) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rand(0.92, 1.08); bp.Q.value = q;
      const bg = c.createGain(); bg.gain.value = g; formants.connect(bp).connect(bg).connect(shaper);
    }
    const stop = t + dur + 0.05;
    for (const det of [0, 9, -13]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
      o.frequency.setValueAtTime(base * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(base * rand(1.0, 1.12), t + 0.09);
      o.frequency.linearRampToValueAtTime(base * rand(0.85, 0.95), t + dur * 0.6);
      o.frequency.exponentialRampToValueAtTime(base * 0.45, t + dur);
      const vib = c.createOscillator(); vib.frequency.value = rand(6, 9); const vg = c.createGain(); vg.gain.value = base * 0.045;
      const jit = c.createOscillator(); jit.type = 'square'; jit.frequency.value = rand(27, 41); const jg = c.createGain(); jg.gain.value = base * 0.02 * rough;
      vib.connect(vg).connect(o.frequency); jit.connect(jg).connect(o.frequency);
      const og = c.createGain(); og.gain.value = 0.35;
      o.connect(og).connect(formants);
      for (const n of [o, vib, jit]) { n.start(t); n.stop(stop); }
    }
    // Atem / Kratzen
    const ns = c.createBufferSource(); ns.buffer = this.noise;
    const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 2600; nb.Q.value = 0.7;
    const ng = c.createGain(); ng.gain.value = 0.35;
    ns.connect(nb).connect(ng).connect(shaper); ns.start(t, Math.random()); ns.stop(stop);
    const post = c.createBiquadFilter(); post.type = 'lowpass'; post.frequency.value = 7000;
    shaper.connect(post).connect(out).connect(this._dest(pos));
  }

  // Wuchtiger Schock-Treffer (Aufprall + kreischendes Metall)
  _impact(k, when = 0) {
    this._tone({ freq: 70, freqEnd: 28, dur: 1.1, gain: 1.0 * k, attack: 0.004, when });
    this._noise({ dur: 0.35, type: 'lowpass', freq: 2500, freqEnd: 200, gain: 0.9 * k, attack: 0.002, when });
    this._noise({ dur: 1.2, freq: 3200, freqEnd: 1800, q: 9, gain: 0.35 * k, attack: 0.005, when });
    for (const f of [233, 247, 349, 370, 523, 554]) this._tone({ freq: f, freqEnd: f * 0.7, type: 'sawtooth', dur: 1.6, gain: 0.07 * k, attack: 0.005, when });
  }

  // ---------- Effekte ----------
  footstep(zone, intensity) {
    const f = { c: 1700, l: 1500, o: 450, s: 900, k: 650 }[zone] || 900;
    this._noise({ dur: 0.06 + intensity * 0.04, freq: f * rand(0.85, 1.15), q: 1.4, gain: 0.08 + intensity * 0.22 });
    this._noise({ dur: 0.1, type: 'lowpass', freq: 180, gain: 0.1 + intensity * 0.2 });
    this._noise({ dur: 0.08, freq: f * 1.6, q: 2, gain: 0.03 + intensity * 0.08, when: 0.05 + rand(0, 0.02) });
    if (zone === 'o' || zone === 'l') { if (Math.random() < 0.12) this._tone({ freq: rand(90, 140), freqEnd: rand(60, 80), type: 'sawtooth', dur: 0.35, gain: 0.04, attack: 0.05 }); }
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
    const f = rand(110, 160);
    this._tone({ freq: f, freqEnd: f * 0.55, type: 'sawtooth', dur: 2.4, gain: gain * 0.5 * this.scareScale, attack: 0.5, pos, vib: 9 });
    this._tone({ freq: f * 1.5, freqEnd: f * 0.8, type: 'triangle', dur: 2.2, gain: gain * 0.6 * this.scareScale, attack: 0.6, pos, vib: 12 });
    this._noise({ dur: 2.2, freq: 500, freqEnd: 300, q: 3, gain: gain * 0.4 * this.scareScale, attack: 0.6, pos });
  }
  whoosh(pos) { this._noise({ dur: 0.6, freq: 400, freqEnd: 2500, q: 2, gain: 0.5 * this.scareScale, attack: 0.15, pos }); }
  // Jumpscare: Aufprall + lauter Schrei
  stinger(strength = 1) {
    const k = strength * this.scareScale;
    this._loud(() => {
      this._impact(k);
      if (this.sample('kreischen', { gain: 1.3 * k, rate: rand(0.9, 1.08) })) {
        if (strength >= 0.6) this._scream({ base: rand(950, 1200), dur: 1.0, gain: 0.45 * k });
      } else if (strength >= 0.6) {
        this._scream({ base: rand(950, 1200), dur: rand(1.0, 1.4), gain: 1.0 * k });
        this._scream({ base: rand(650, 750), dur: 1.1, gain: 0.55 * k, rough: 1.8, when: 0.02 });
      } else this._noise({ dur: 0.9, type: 'highpass', freq: 1500, gain: 0.5 * k, attack: 0.005 });
    }, 1.3);
  }
  // Der Geist entdeckt dich und schreit dich an
  yell(strength = 1) {
    const k = strength * this.scareScale;
    this._loud(() => {
      this._impact(k * 1.1);
      this.sample('kreischen', { gain: 1.3 * k, rate: 0.78 });   // tiefer: er brüllt dich an
      this._scream({ base: 820, dur: 1.6, gain: 1.0 * k, rough: 2.2 });
      this._scream({ base: 1250, dur: 1.3, gain: 0.6 * k, when: 0.04 });
      this._noise({ dur: 1.2, freq: 1800, freqEnd: 900, q: 0.7, gain: 0.5 * k, attack: 0.01 });
    }, 1.6);
  }
  // Todesschrei: lang, ohrenbetäubend, mehrstimmig
  scream(strength = 1) {
    const k = strength * this.scareScale;
    this._loud(() => {
      this._impact(k * 1.3);
      this._impact(k * 0.8, 0.5);
      this.sample('kreischen', { gain: 1.4 * k, rate: 0.9 });
      this.sample('kreischen', { gain: 1.1 * k, rate: 0.7, when: 0.6 });
      this.sample('maedchen', { gain: 1.2 * k, rate: 0.82, when: 0.15 });
      this._scream({ base: 1100, dur: 2.3, gain: 1.0 * k });
      this._scream({ base: 720, dur: 2.2, gain: 0.8 * k, when: 0.03, rough: 2 });
      this._scream({ base: 1500, dur: 1.6, gain: 0.55 * k, when: 0.25 });
      this._scream({ base: 420, dur: 2.0, gain: 0.6 * k, when: 0.1, rough: 3 });
      this._noise({ dur: 2.2, type: 'highpass', freq: 2500, gain: 0.45 * k, attack: 0.01 });
    }, 2.6);
  }
  ghostShriek(pos) { this._scream({ base: rand(650, 800), dur: 1.3, gain: 0.75 * this.scareScale, pos, rough: 1.8 }); }
  growl(pos) {
    this._scream({ base: rand(110, 150), dur: rand(0.7, 1.1), gain: 0.5 * this.scareScale, pos, rough: 3 });
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
  // Schrei eines Mädchens (für das Mädchen-Ereignis)
  girlScream(pos, strength = 1) {
    const k = strength * this.scareScale;
    if (!this.samples || !this.samples.maedchen) { this.stinger(strength); return; }
    this._loud(() => { this._impact(k * 0.7); this.sample('maedchen', { gain: 1.5 * k, pos, rate: rand(0.95, 1.05) }); }, 2.2);
  }
  // Unheimliche Stimmen aus der Ferne (Ausschnitt aus der Aufnahme)
  voices(pos) {
    const buf = this.samples && this.samples.stimmen;
    if (!buf) return false;
    const len = rand(5, 9);
    return this.sample('stimmen', { gain: 0.9, pos, offset: rand(0, buf.duration - len - 0.5), duration: len, rate: rand(0.85, 1), fadeOut: 1.5 });
  }
  distantScream(pos) {
    if (this.sample('maedchen', { gain: 0.9 * this.scareScale, pos, rate: rand(0.8, 0.95) })) return;
    this._scream({ base: rand(850, 1050), dur: 1.9, gain: 0.7 * this.scareScale, pos });
  }
  pipeGroan(pos) {
    this._tone({ freq: rand(45, 70), freqEnd: rand(30, 45), type: 'sawtooth', dur: 2.5, gain: 0.12, attack: 0.6, pos, vib: 3 });
    this._noise({ dur: 2.2, freq: rand(250, 500), freqEnd: rand(150, 250), q: 14, gain: 0.25, attack: 0.5, pos });
  }
  metalClank(pos) {
    for (const f of [rand(400, 600), rand(900, 1300), rand(2100, 2600)]) this._tone({ freq: f, freqEnd: f * 0.98, type: 'triangle', dur: 1.4, gain: 0.08, attack: 0.002, pos });
    this._noise({ dur: 0.08, type: 'highpass', freq: 2000, gain: 0.3, pos });
  }
  thunder() {
    this._noise({ dur: 4, type: 'lowpass', freq: 220, freqEnd: 60, gain: 0.5, attack: 0.4, buffer: this.brown });
    this._noise({ dur: 2.5, type: 'lowpass', freq: 500, freqEnd: 120, gain: 0.25, attack: 0.05, buffer: this.brown, when: 0.2 });
  }
  crying(pos) {
    for (let i = 0; i < 4; i++) {
      const f = rand(380, 460);
      this._tone({ freq: f, freqEnd: f * 0.75, type: 'triangle', dur: 0.9, gain: 0.07, attack: 0.15, pos, when: i * 1.0, vib: 14 });
      this._noise({ dur: 0.4, freq: 1500, q: 1, gain: 0.04, attack: 0.1, pos, when: i * 1.0 + 0.85 });
    }
  }
  drip(pos) { this._tone({ freq: rand(1700, 2600), freqEnd: rand(700, 1000), dur: 0.09, gain: 0.12, pos }); }
  tomHit(k) { this._tone({ freq: 95, freqEnd: 45, dur: 0.35, gain: 0.55 * k, attack: 0.003 }); this._noise({ dur: 0.08, type: 'lowpass', freq: 900, gain: 0.3 * k }); }
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

  // Elektrisches Knistern der Isolatoren
  zap(pos) {
    for (let i = 0; i < 4; i++) this._noise({ dur: 0.03 + Math.random() * 0.04, type: 'highpass', freq: rand(2500, 5000), gain: 0.35, pos, when: i * rand(0.02, 0.06) });
    this._tone({ freq: 100, type: 'sawtooth', dur: 0.15, gain: 0.08, pos });
  }

  // ---------- Bengalos ----------
  flareIgnite() {
    this._noise({ dur: 0.5, type: 'highpass', freq: 2500, gain: 0.5, attack: 0.01 });
    this._noise({ dur: 0.3, freq: 600, freqEnd: 2000, q: 1, gain: 0.3 });
  }
  flareLand(pos) { this._noise({ dur: 0.12, type: 'lowpass', freq: 900, gain: 0.35, pos }); }
  // Dauerhaftes Zischen/Knistern eines brennenden Bengalos
  flareLoop(pos) {
    const dummy = { setPos() {}, stop() {} };
    if (!this.ctx) return dummy;
    const c = this.ctx;
    const src = this._loop(this.noise);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.value = 0.28;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13;
    const lg = c.createGain(); lg.gain.value = 0.08; lfo.connect(lg).connect(g.gain); lfo.start();
    const p = this._panner(pos.x, pos.y, pos.z);
    src.connect(f).connect(g).connect(p).connect(this.sfx);
    return {
      setPos: (q, fade = 1) => { this._setPos(p, q.x, q.y, q.z); g.gain.setTargetAtTime(0.28 * fade, c.currentTime, 0.1); },
      stop: () => { try { src.stop(); lfo.stop(); } catch { /* schon gestoppt */ } },
    };
  }

  // ---------- Welt-Ereignisse & Hilfe ----------
  keyChime(pos) { [1568, 2093].forEach((f, i) => this._tone({ freq: f, dur: 0.5, gain: 0.07, pos, when: i * 0.09 })); }
  hintPing() { [784, 1175, 1568].forEach((f, i) => this._tone({ freq: f, dur: 0.6, gain: 0.1, when: i * 0.07 })); }
  musicBox(pos) {
    const notes = [659, 622, 659, 494, 587, 523, 440, 0, 262, 330, 440, 494];
    notes.forEach((f, i) => { if (f) this._tone({ freq: f, dur: 0.7, gain: 0.08, pos, when: i * 0.32 * (1 + i * 0.03) }); });
  }
  bulbPop(pos) {
    this._noise({ dur: 0.08, type: 'highpass', freq: 3000, gain: 0.6, pos });
    for (let i = 0; i < 5; i++) this._noise({ dur: 0.05, freq: rand(3000, 6000), q: 4, gain: 0.2, pos, when: 0.05 + i * rand(0.03, 0.09) });
  }
  creakSlow(pos) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(60, t);
    for (let i = 1; i < 20; i++) o.frequency.linearRampToValueAtTime(rand(45, 120), t + i * 0.12);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 9;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(f).connect(g).connect(this._dest(pos)); o.start(t); o.stop(t + 2.5);
  }

  setGhost(pos, intensity) {
    if (!this.ctx) return;
    this.gpos = { x: pos.x, y: 1.6, z: pos.z }; this.gint = intensity;
    this._setPos(this.ghostPan, pos.x, 1.5, pos.z);
    this.ghostGain.gain.setTargetAtTime(intensity, this.ctx.currentTime, 0.2);
  }

  setThreat(t) {
    this.threat = t;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(clamp(t, 0, 1) * 0.55, this.ctx.currentTime, 0.6);
    if (this.bed && this.inGame) this.bed.gain.setTargetAtTime(t > 0.85 ? 0.05 : 0.22, this.ctx.currentTime, 1.0);
  }

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
    // Verfolgung: treibende Trommeln und Knurren des Geistes
    if (this.threat > 0.9) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) { this.pulseT = 0.42; this.beat = (this.beat || 0) + 1; this.tomHit(this.beat % 4 === 0 ? 1 : 0.6); }
      this.growlT = (this.growlT ?? 2) - dt;
      if (this.growlT <= 0 && this.gpos) { this.growlT = rand(2.2, 4); this.growl(this.gpos); }
    }
    // Geräuschkulisse
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = rand(3, 8);
      const p = { x: (this.lx || 0) + rand(-14, 14), y: rand(1, 3.5), z: (this.lz || 0) + rand(-14, 14) };
      const pick = inKeller ? choiceW([['drip', 4], ['pipe', 3], ['clank', 2], ['creak', 1]]) : choiceW([['creak', 3], ['pipe', 2], ['clank', 1], ['thunder', 1], ['cry', 1], ['drip', 1], ['knock', 1], ['voices', 2]]);
      if (pick === 'drip') { for (let i = 0; i < 3; i++) this._tone({ freq: rand(1700, 2600), freqEnd: 900, dur: 0.09, gain: 0.1, pos: p, when: i * rand(0.4, 0.9) }); }
      else if (pick === 'pipe') this.pipeGroan(p);
      else if (pick === 'clank') this.metalClank(p);
      else if (pick === 'thunder') this.thunder();
      else if (pick === 'cry') this.crying(p);
      else if (pick === 'knock') this.knock(p);
      else if (pick === 'voices') { if (!this.voices(p)) this.crying(p); }
      else this.creakSlow(p);
    }
  }
}

function choiceW(list) {
  let r = Math.random() * list.reduce((s, x) => s + x[1], 0);
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[0][0];
}
