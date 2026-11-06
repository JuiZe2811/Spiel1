// Geistergesicht: Standardgesicht, Foto-Verarbeitung (nur lokal) und Zuschneide-Editor.
import * as THREE from '../vendor/three.module.min.js';
import { store, clamp } from './util.js';

const FACE_KEY = 'f5s_face_v1';
const SIZE = 512;

function ovalMask(ctx, size, soft = 0.22) {
  // Weiche ovale Maske über den Alphakanal
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data, cx = size / 2, cy = size / 2, rx = size * 0.46, ry = size * 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const r = Math.sqrt(nx * nx + ny * ny);
    const a = clamp((1 - r) / soft, 0, 1);
    const i = (y * size + x) * 4;
    d[i + 3] = d[i + 3] * a;
  }
  ctx.putImageData(img, 0, 0);
}

function drawDefaultFace(ctx) {
  const s = SIZE;
  ctx.clearRect(0, 0, s, s);
  const skin = ctx.createRadialGradient(s / 2, s * 0.42, s * 0.05, s / 2, s / 2, s * 0.55);
  skin.addColorStop(0, '#d9dfdf'); skin.addColorStop(0.6, '#9aa5a7'); skin.addColorStop(1, '#3b4446');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(s / 2, s / 2, s * 0.42, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // Wangenschatten
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(s / 2 + sx * s * 0.22, s * 0.62, 5, s / 2 + sx * s * 0.22, s * 0.62, s * 0.16);
    g.addColorStop(0, 'rgba(30,40,45,0.55)'); g.addColorStop(1, 'rgba(30,40,45,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
  // Augenhöhlen
  for (const sx of [-1, 1]) {
    const ex = s / 2 + sx * s * 0.15, ey = s * 0.42;
    const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, s * 0.13);
    g.addColorStop(0, '#000'); g.addColorStop(0.55, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(10,15,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.13, s * 0.1, sx * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(235,245,240,0.95)';
    ctx.beginPath(); ctx.arc(ex + sx * 4, ey + 6, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Nase
  ctx.fillStyle = 'rgba(20,25,28,0.7)';
  ctx.beginPath(); ctx.ellipse(s / 2 - 10, s * 0.6, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(s / 2 + 10, s * 0.6, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Aufgerissener Mund
  const m = ctx.createRadialGradient(s / 2, s * 0.77, 4, s / 2, s * 0.77, s * 0.13);
  m.addColorStop(0, '#000'); m.addColorStop(0.7, '#0a0303'); m.addColorStop(1, 'rgba(40,10,10,0)');
  ctx.fillStyle = m;
  ctx.beginPath(); ctx.ellipse(s / 2, s * 0.77, s * 0.08, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  // Risse und Adern
  ctx.strokeStyle = 'rgba(25,30,40,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    let x = s / 2 + (Math.random() - 0.5) * s * 0.6, y = s * (0.15 + Math.random() * 0.7);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.3) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Tränen aus den Augen
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (const sx of [-1, 1]) ctx.fillRect(s / 2 + sx * s * 0.15 - 3, s * 0.47, 6, s * 0.18 + Math.random() * 30);
  ovalMask(ctx, s, 0.18);
}

// Wandelt ein zugeschnittenes Foto in ein bleiches Geistergesicht um.
function ghostify(ctx, src) {
  const s = SIZE;
  ctx.clearRect(0, 0, s, s);
  ctx.drawImage(src, 0, 0, s, s);
  const img = ctx.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    v = clamp((v - 128) * 1.45 + 132, 0, 255);
    d[i] = v * 0.84; d[i + 1] = v * 0.94; d[i + 2] = clamp(v * 1.02 + 8, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  // Dunkler Rand und Kratzer
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,5,10,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(10,15,20,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 60, y + Math.random() * 80); ctx.stroke();
  }
  ovalMask(ctx, s, 0.2);
}

export class FaceManager {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.isCustom = false;
    this.listeners = [];
    this.dataURL = '';
    const saved = store.getRaw(FACE_KEY);
    if (saved) this._loadDataURL(saved); else this.useDefault(false);
  }
  onChange(fn) { this.listeners.push(fn); }
  _changed() {
    this.texture.needsUpdate = true;
    this.dataURL = this.canvas.toDataURL('image/png');
    this.listeners.forEach((f) => f(this));
  }
  useDefault(persist = true) {
    drawDefaultFace(this.ctx);
    this.isCustom = false;
    if (persist) store.del(FACE_KEY);
    this._changed();
  }
  _loadDataURL(url) {
    const img = new Image();
    img.onload = () => { ghostify(this.ctx, img); this.isCustom = true; this._changed(); };
    img.onerror = () => this.useDefault();
    img.src = url;
    drawDefaultFace(this.ctx); this._changed();
  }
  // Nimmt den zugeschnittenen Ausschnitt (quadratisches Canvas) entgegen.
  setFromCrop(cropCanvas) {
    ghostify(this.ctx, cropCanvas);
    this.isCustom = true;
    this._changed();
    const small = document.createElement('canvas');
    small.width = small.height = 384;
    small.getContext('2d').drawImage(cropCanvas, 0, 0, 384, 384);
    return store.setRaw(FACE_KEY, small.toDataURL('image/jpeg', 0.85));
  }
}

// Zuschneide-Editor: Ziehen zum Verschieben, Regler / Zwei-Finger / Mausrad zum Zoomen.
export class FaceEditor {
  constructor(canvas, zoomInput) {
    this.canvas = canvas;
    this.zoomInput = zoomInput;
    this.img = null;
    this.zoom = 1; this.ox = 0; this.oy = 0;
    this.pointers = new Map();
    this.pinchStart = null;
    const c = canvas;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.pointers.size === 2) this.pinchStart = { d: this._pinchDist(), z: this.zoom }; });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.img) return;
      if (this.pointers.size === 1) {
        const k = this._viewSize() / c.getBoundingClientRect().width;
        this.ox += (e.clientX - p.x) * k; this.oy += (e.clientY - p.y) * k;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinchStart) this.setZoom(this.pinchStart.z * this._pinchDist() / this.pinchStart.d);
      this.draw();
    });
    const up = (e) => { this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinchStart = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : 0.93)); }, { passive: false });
    zoomInput.addEventListener('input', () => this.setZoom(parseFloat(zoomInput.value)));
  }
  _viewSize() { return this.canvas.width; }
  _pinchDist() { const [a, b] = [...this.pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
  setZoom(z) { this.zoom = clamp(z, 1, 4); this.zoomInput.value = this.zoom; this.draw(); }
  load(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Keine Datei'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { this.img = img; this.zoom = 1; this.ox = this.oy = 0; this.zoomInput.value = 1; this.draw(); resolve(); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
      img.src = url;
    });
  }
  // Zeichnet das Bild in ein Ziel-Canvas der Größe size.
  _render(ctx, size) {
    const img = this.img, base = Math.max(size / img.width, size / img.height) * this.zoom;
    const k = size / this._viewSize();
    const w = img.width * base, h = img.height * base;
    ctx.drawImage(img, size / 2 - w / 2 + this.ox * k, size / 2 - h / 2 + this.oy * k, w, h);
  }
  draw() {
    const c = this.canvas, ctx = c.getContext('2d'), s = c.width;
    ctx.fillStyle = '#0b0c0d'; ctx.fillRect(0, 0, s, s);
    if (!this.img) return;
    this._render(ctx, s);
    // Ovale Führung: Gesicht hier hinein schieben
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.rect(0, 0, s, s); ctx.ellipse(s / 2, s / 2, s * 0.4, s * 0.48, 0, 0, Math.PI * 2, true); ctx.fill();
    ctx.strokeStyle = 'rgba(217,194,122,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(s / 2, s / 2, s * 0.4, s * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  crop() {
    if (!this.img) return null;
    const out = document.createElement('canvas');
    out.width = out.height = SIZE;
    this._render(out.getContext('2d'), SIZE);
    return out;
  }
}
