// Andere Wesen für die Schreckmomente. Sie haben nichts mit dem jagenden Geist zu tun und sind harmlos.
import * as THREE from '../vendor/three.module.min.js';
import { rand } from './util.js';

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.95 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a3632 });
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);

function eyeSprite(glow, color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}

function faceTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Entity {
  constructor() { this.group = new THREE.Group(); this.group.visible = false; this.t = 0; }
  show(x, z, faceX, faceZ) {
    this.group.position.set(x, 0, z);
    this.group.rotation.set(0, faceX === undefined ? 0 : Math.atan2(faceX - x, faceZ - z), 0);
    this.group.visible = true;
  }
  hide() { this.group.visible = false; }
  animate(dt) { this.t += dt; }
}

// Sehr großer, dünner Schattenmann mit weiß glühenden Augen.
export class ShadowMan extends Entity {
  constructor(glow) {
    super();
    const g = this.group;
    const torso = capsule(0.15, 0.85, shadowMat); torso.position.y = 1.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), shadowMat); head.position.y = 2.52; head.scale.y = 1.3;
    g.add(torso, head);
    this.legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.09, 1.35, 0); const l = capsule(0.055, 1.15, shadowMat); l.position.y = -0.62; p.add(l); g.add(p); return p; });
    this.arms = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.22, 2.22, 0);
      const a = capsule(0.035, 1.35, shadowMat); a.position.y = -0.7; p.add(a);
      for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.012), shadowMat); f.position.set((i - 1.5) * 0.02, -1.48, 0.02); f.rotation.x = 0.2; p.add(f); }
      p.rotation.z = s * 0.08; g.add(p); return p;
    });
    this.eyes = [-1, 1].map((s) => { const e = eyeSprite(glow, 0xffffff, 0.16); e.position.set(s * 0.05, 2.55, 0.12); g.add(e); return e; });
  }
  animate(dt, walk = 0) {
    super.animate(dt);
    const t = this.t;
    this.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * (walk ? 3 : 0.8) + i * Math.PI) * (walk ? 0.4 : 0.06); });
    this.legs.forEach((l, i) => { l.rotation.x = walk ? Math.sin(t * 3 + i * Math.PI) * 0.35 : 0; });
    this.group.children[1].rotation.z = Math.sin(t * 0.7) * 0.15;
  }
  setEyes(on) { this.eyes.forEach((e) => { e.visible = on; }); }
}

// Krabbelndes Wesen auf allen Vieren mit roten Augen.
export class Crawler extends Entity {
  constructor(glow) {
    super();
    const g = this.group;
    const body = capsule(0.13, 0.75, darkMat); body.rotation.x = Math.PI / 2; body.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), darkMat); head.position.set(0, 0.5, 0.6); head.scale.set(1, 0.9, 1.2);
    g.add(body, head);
    this.legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.12, 0.45, sz * 0.32);
      const up = capsule(0.025, 0.45, darkMat); up.position.set(sx * 0.2, 0.13, 0); up.rotation.z = -sx * 1.0; hip.add(up);
      const low = capsule(0.022, 0.5, darkMat); low.position.set(sx * 0.42, -0.15, 0); low.rotation.z = sx * 0.35; hip.add(low);
      g.add(hip); this.legs.push({ hip, phase: (sx + sz * 2) * 0.8 });
    }
    [-1, 1].forEach((s) => { const e = eyeSprite(glow, 0xff2010, 0.13); e.position.set(s * 0.055, 0.54, 0.75); g.add(e); });
  }
  animate(dt, speed = 0) {
    super.animate(dt);
    const t = this.t;
    for (const l of this.legs) l.hip.rotation.y = Math.sin(t * (4 + speed * 3) + l.phase) * (0.15 + Math.min(speed, 8) * 0.06);
    this.group.children[0].position.y = 0.42 + Math.abs(Math.sin(t * (4 + speed * 3))) * 0.04;
  }
}

// Kleines Mädchen, das zur Wand starrt und den Kopf ganz herumdreht.
export class Child extends Entity {
  constructor() {
    super();
    const g = this.group;
    const cloth = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xb9bfc0 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x050505, side: THREE.DoubleSide });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 12, 1, true), cloth); dress.position.y = 0.42;
    const chest = capsule(0.11, 0.2, cloth); chest.position.y = 0.85;
    g.add(dress, chest);
    [-1, 1].forEach((s) => { const a = capsule(0.03, 0.4, skin); a.position.set(s * 0.15, 0.68, 0); a.rotation.z = s * 0.15; g.add(a); });
    this.head = new THREE.Group(); this.head.position.y = 1.12;
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), skin));
    const face = faceTexture((x, w, h) => {
      x.fillStyle = '#b9bfc0'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#000'; x.beginPath(); x.ellipse(40, 58, 15, 18, 0, 0, 7); x.ellipse(88, 58, 15, 18, 0, 0, 7); x.fill();
      x.fillRect(58, 96, 12, 4);
    });
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 12, Math.PI / 2 - 0.9, 1.8, 0.7, 1.6), new THREE.MeshBasicMaterial({ map: face, color: 0x8a9092 }));
    this.head.add(fm);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10, -Math.PI / 2 - 1.7, 3.4, 0, 2.2), hair); this.head.add(back);
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; const st = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.55), hair); st.position.set(Math.cos(a) * 0.12, -0.25, -Math.sin(a) * 0.12); st.rotation.y = a + Math.PI / 2; this.head.add(st); }
    g.add(this.head);
  }
  animate(dt) { super.animate(dt); }
}

// Porzellanpuppe mit schwarzen Augen
export class Doll extends Entity {
  constructor() {
    super();
    const g = this.group;
    const dressM = new THREE.MeshLambertMaterial({ color: 0x5e0f10 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe3dccf });
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 10), dressM); dress.position.y = 0.12;
    g.add(dress);
    [-1, 1].forEach((s) => { const a = capsule(0.015, 0.1, skin); a.position.set(s * 0.07, 0.2, 0.02); a.rotation.z = s * 0.5; g.add(a); });
    this.head = new THREE.Group(); this.head.position.y = 0.3;
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), skin));
    const face = faceTexture((x, w, h) => {
      x.fillStyle = '#e3dccf'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#000'; x.beginPath(); x.arc(40, 60, 14, 0, 7); x.arc(88, 60, 14, 0, 7); x.fill();
      x.fillStyle = '#7a0a0a'; x.beginPath(); x.ellipse(64, 98, 7, 4, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(40,30,20,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(90, 10); x.lineTo(78, 40); x.lineTo(84, 52); x.stroke();
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(38, 72, 4, 30);
    });
    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 12, Math.PI / 2 - 0.9, 1.8, 0.6, 1.7), new THREE.MeshLambertMaterial({ map: face })));
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 8, -Math.PI / 2 - 1.8, 3.6, 0, 1.9), new THREE.MeshLambertMaterial({ color: 0x3b2414 }));
    this.head.add(hair);
    g.add(this.head);
  }
}

// Schaufensterpuppe ohne Gesicht – bewegt sich nur, wenn man nicht hinsieht.
export class Mannequin extends Entity {
  constructor() {
    super();
    const g = this.group;
    const m = new THREE.MeshLambertMaterial({ color: 0xcbbca7 });
    const torso = capsule(0.17, 0.5, m); torso.position.y = 1.28; torso.scale.z = 0.7;
    const hip = capsule(0.15, 0.1, m); hip.position.y = 0.92; hip.scale.z = 0.75;
    const neck = capsule(0.05, 0.08, m); neck.position.y = 1.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), m); head.position.y = 1.8; head.scale.set(1, 1.3, 1.05);
    g.add(torso, hip, neck, head);
    [-1, 1].forEach((s) => {
      const l = capsule(0.065, 0.75, m); l.position.set(s * 0.09, 0.45, 0); g.add(l);
      const a = capsule(0.045, 0.62, m); a.position.set(s * 0.25, 1.15, 0.03); a.rotation.z = s * 0.12; g.add(a);
    });
  }
}

// Paare roter Augen in der Dunkelheit
export class EyePairs {
  constructor(glow, count = 9) {
    this.group = new THREE.Group();
    this.pairs = [];
    for (let i = 0; i < count; i++) {
      const p = new THREE.Group();
      [-1, 1].forEach((s) => { const e = eyeSprite(glow, 0xff1a08, 0.11); e.position.x = s * 0.06; p.add(e); });
      p.visible = false; this.group.add(p); this.pairs.push(p);
    }
  }
  hide() { this.pairs.forEach((p) => { p.visible = false; }); }
}

// Schwarze Arme, die aus der Wand greifen
export class WallHands {
  constructor(count = 5) {
    this.group = new THREE.Group(); this.group.visible = false;
    this.arms = [];
    for (let i = 0; i < count; i++) {
      const a = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), shadowMat); arm.position.z = 0.5;
      a.add(arm);
      for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.2), shadowMat); fi.position.set((f - 1.5) * 0.022, 0, 1.08); fi.rotation.y = (f - 1.5) * 0.15; a.add(fi); }
      this.group.add(a); this.arms.push(a);
    }
  }
}

// ---------- Andere Schreckgesichter (für Bildschirm-Schocks) ----------
function faceCanvas(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d');
  x.filter = 'blur(1.5px)';
  draw(x, 512);
  x.filter = 'none';
  // Körnung, Kratzer und dunkler Rand: wirkt wie ein altes, verrauschtes Foto
  const img = x.getImageData(0, 0, 512, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = (Math.random() - 0.5) * 70, v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    d[i] = Math.max(0, Math.min(255, v * 0.95 + n)); d[i + 1] = Math.max(0, Math.min(255, v * 0.92 + n)); d[i + 2] = Math.max(0, Math.min(255, v * 0.9 + n));
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  const v = x.createRadialGradient(256, 256, 120, 256, 256, 300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.8)');
  x.fillStyle = v; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5;
  for (let i = 0; i < 25; i++) { const px = Math.random() * 512; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() - 0.5) * 40, 512); x.stroke(); }
  return c.toDataURL('image/png');
}

export function makeScareFaces() {
  const grin = faceCanvas((x, s) => {
    const g = x.createRadialGradient(s / 2, s * 0.45, 20, s / 2, s / 2, s * 0.5);
    g.addColorStop(0, '#d6d2c4'); g.addColorStop(0.7, '#7d786c'); g.addColorStop(1, 'rgba(20,18,14,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(s / 2, s / 2, s * 0.4, s * 0.48, 0, 0, 7); x.fill();
    for (const ex of [-1, 1]) { x.fillStyle = '#000'; x.beginPath(); x.ellipse(s / 2 + ex * 80, s * 0.38, 34, 26, ex * 0.3, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(s / 2 + ex * 80, s * 0.38, 6, 0, 7); x.fill(); }
    x.fillStyle = '#100404'; x.beginPath(); x.moveTo(s * 0.16, s * 0.58); x.quadraticCurveTo(s / 2, s * 0.92, s * 0.84, s * 0.58); x.quadraticCurveTo(s / 2, s * 0.72, s * 0.16, s * 0.58); x.fill();
    x.fillStyle = '#e8e1c8';
    for (let i = 0; i < 18; i++) { const t = i / 17, px = s * (0.2 + t * 0.6), py = s * (0.6 + Math.sin(t * Math.PI) * 0.12); x.beginPath(); x.moveTo(px - 9, py); x.lineTo(px + 9, py); x.lineTo(px, py + 24); x.fill(); }
  });
  const eyeless = faceCanvas((x, s) => {
    x.fillStyle = '#5c5a55'; x.beginPath(); x.ellipse(s / 2, s / 2, s * 0.38, s * 0.48, 0, 0, 7); x.fill();
    for (const ex of [-1, 1]) {
      const g = x.createRadialGradient(s / 2 + ex * 75, s * 0.4, 4, s / 2 + ex * 75, s * 0.4, 60);
      g.addColorStop(0, '#000'); g.addColorStop(0.7, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(s / 2 + ex * 75, s * 0.4, 60, 0, 7); x.fill();
      x.fillStyle = '#3a0000'; x.fillRect(s / 2 + ex * 75 - 6, s * 0.45, 12, 140 + Math.random() * 60);
    }
    x.fillStyle = '#000'; x.beginPath(); x.ellipse(s / 2, s * 0.78, 50, 80, 0, 0, 7); x.fill();
  });
  const screamer = faceCanvas((x, s) => {
    x.fillStyle = '#2b2622'; x.beginPath(); x.ellipse(s / 2, s / 2, s * 0.3, s * 0.5, 0, 0, 7); x.fill();
    x.fillStyle = '#8f877b'; x.beginPath(); x.ellipse(s / 2, s * 0.45, s * 0.26, s * 0.42, 0, 0, 7); x.fill();
    for (const ex of [-1, 1]) { x.fillStyle = '#000'; x.beginPath(); x.ellipse(s / 2 + ex * 55, s * 0.3, 26, 44, 0, 0, 7); x.fill(); x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(s / 2 + ex * 55, s * 0.31, 5, 0, 7); x.fill(); }
    x.fillStyle = '#050000'; x.beginPath(); x.ellipse(s / 2, s * 0.66, 62, 130, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(30,20,15,0.8)'; x.lineWidth = 3;
    for (let i = 0; i < 12; i++) { x.beginPath(); const px = s / 2 + rand(-120, 120), py = rand(60, 450); x.moveTo(px, py); x.lineTo(px + rand(-30, 30), py + rand(20, 60)); x.stroke(); }
  });
  return { grin, eyeless, screamer };
}
