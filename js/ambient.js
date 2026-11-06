// Unheimliche Welt-Ereignisse im Hintergrund: Die Welt verändert sich, während du nicht hinsiehst.
// Alles hier ist harmlos – es passiert nur etwas in der Umgebung.
import * as THREE from '../vendor/three.module.min.js';
import { rand, choice } from './util.js';
import { CS } from './world.js';

const WRITINGS = ['RAUS', 'ER SIEHT DICH', 'LAUF', 'HILFE', 'ZU SPÄT', 'NICHT UMDREHEN', 'FÜNF', 'BLEIB', 'ER IST HIER', 'DU BIST DRAN'];

function writingTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.translate(256, 128); x.rotate(rand(-0.12, 0.12));
  let size = 120;
  x.font = `${size}px "IM Fell English SC", Georgia, serif`;
  while (x.measureText(text).width > 470 && size > 40) { size -= 6; x.font = `${size}px "IM Fell English SC", Georgia, serif`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(120,8,6,0.9)';
  x.fillText(text, 0, 0);
  // Verlaufene Farbe
  const w = x.measureText(text).width;
  for (let i = 0; i < 14; i++) {
    const dx = rand(-w / 2, w / 2), len = rand(20, 90);
    const g = x.createLinearGradient(0, size * 0.25, 0, size * 0.25 + len);
    g.addColorStop(0, 'rgba(110,6,4,0.85)'); g.addColorStop(1, 'rgba(110,6,4,0)');
    x.fillStyle = g; x.fillRect(dx, size * 0.2, rand(2, 5), len);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function handTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(95,8,6,0.85)';
  const hand = (hx, hy, rot, s) => {
    x.save(); x.translate(hx, hy); x.rotate(rot); x.scale(s, s);
    x.beginPath(); x.ellipse(0, 10, 20, 24, 0, 0, Math.PI * 2); x.fill();
    [[-17, -22, -0.4], [-7, -30, -0.1], [4, -31, 0.05], [14, -26, 0.25]].forEach(([fx, fy, fr]) => {
      x.save(); x.translate(fx, fy); x.rotate(fr); x.beginPath(); x.ellipse(0, -8, 5, 16, 0, 0, Math.PI * 2); x.fill(); x.restore();
    });
    x.save(); x.translate(22, 6); x.rotate(0.9); x.beginPath(); x.ellipse(0, -6, 5, 13, 0, 0, Math.PI * 2); x.fill(); x.restore();
    x.restore();
  };
  for (let i = 0; i < 5; i++) hand(rand(40, 216), rand(50, 210), rand(-0.6, 0.6), rand(0.8, 1.1));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class AmbientDirector {
  constructor(game, shadowModel) {
    this.g = game;
    this.figure = shadowModel;
    shadowModel.group.visible = false;
    game.scene.add(shadowModel.group);
    this.textures = [...WRITINGS.map(writingTexture), handTexture(), handTexture()];
    this.decals = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({
        transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.visible = false;
      game.scene.add(m);
      this.decals.push(m);
    }
    this.decalIdx = 0;
    this.reset();
  }

  reset() {
    this.timer = 0; this.next = rand(4, 8);
    this.active = null;
    this.figure.group.visible = false;
    this.decals.forEach((d) => { d.visible = false; });
  }

  update(dt) {
    if (this.active) {
      this.active.t += dt;
      if (this.active.step(dt, this.active.t)) { this.active = null; this.figure.group.visible = false; }
    }
    this.timer += dt;
    if (this.timer < this.next || this.active) return;
    if (this.g.ghost.chasing) { this.next = this.timer + 3; return; }
    this.timer = 0;
    this.next = rand(5, 10) - this.g.keysCollected * 0.5;
    const ev = choice(['writing', 'writing', 'writing', 'doorCreak', 'doorCreak', 'bulbPop', 'farFigure', 'farFigure',
      'chairTurn', 'chairTurn', 'musicBox', 'knockFar', 'stepsAbove']);
    const r = this[ev]();
    if (r) { r.t = 0; this.active = r; }
  }

  // ---------- Hilfen ----------
  info() {
    const p = this.g.player, f = p.forward();
    return { x: p.pos.x, z: p.pos.z, fx: f.x, fz: f.z };
  }
  inView(x, z, minDot = 0.4) {
    const P = this.info(), dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * P.fx + dz * P.fz) / d > minDot;
  }

  // Sucht eine Wand in Richtung (dx,dz) und gibt Trefferpunkt + Normale zurück.
  wallHit(dx, dz, maxD) {
    const w = this.g.world, P = this.info();
    let pcx = w.cell(P.x), pcz = w.cell(P.z);
    for (let d = 0.3; d < maxD; d += 0.1) {
      const x = P.x + dx * d, z = P.z + dz * d, cx = w.cell(x), cz = w.cell(z);
      if (w.isWallish(cx, cz) && w.ch(cx, cz) !== 'X') {
        if (cx !== pcx && cz !== pcz) return null; // Ecke: lieber nicht
        if (cx !== pcx) { const fx = dx > 0 ? cx * CS : (cx + 1) * CS; return { x: fx, z, nx: dx > 0 ? -1 : 1, nz: 0, d }; }
        const fz = dz > 0 ? cz * CS : (cz + 1) * CS; return { x, z: fz, nx: 0, nz: dz > 0 ? -1 : 1, d };
      }
      if (w.blocksSight(cx, cz)) return null;
      pcx = cx; pcz = cz;
    }
    return null;
  }

  // ---------- Ereignisse ----------
  writing() {
    const P = this.info();
    const base = Math.atan2(P.fx, P.fz);
    for (let i = 0; i < 12; i++) {
      const a = base + Math.PI + rand(-1.3, 1.3);   // hinter dem Spieler
      const hit = this.wallHit(Math.sin(a), Math.cos(a), 9);
      if (!hit || hit.d < 1.2) continue;
      const m = this.decals[this.decalIdx++ % this.decals.length];
      const tex = choice(this.textures);
      const isHand = tex.image.width === 256;
      m.material.map = tex; m.material.needsUpdate = true;
      m.scale.set(isHand ? 0.7 : 1.5, isHand ? 0.7 : 0.75, 1);
      m.position.set(hit.x + hit.nx * 0.02, rand(1.2, 1.9), hit.z + hit.nz * 0.02);
      m.rotation.set(0, Math.atan2(hit.nx, hit.nz), 0);
      m.visible = true;
      if (Math.random() < 0.4) this.g.audio.whisper({ x: m.position.x, y: 1.6, z: m.position.z });
      return null;
    }
    return null;
  }

  doorCreak() {
    const P = this.info(), w = this.g.world;
    const doors = w.doors.filter((d) => !d.open && Math.hypot(d.x - P.x, d.z - P.z) < 13 && Math.hypot(d.x - P.x, d.z - P.z) > 2.5);
    if (!doors.length) return this.knockFar();
    const d = choice(doors);
    w.setDoor(d, true, d.x + rand(-1, 1), d.z + rand(-1, 1));
    d.speed = 0.7; // ganz langsam, wie von Geisterhand
    this.g.audio.creakSlow({ x: d.x, y: 1.2, z: d.z });
    return null;
  }

  bulbPop() {
    const P = this.info();
    const lights = this.g.world.lights.filter((L) => L.light.visible && !(L.dead > 0) && Math.hypot(L.light.position.x - P.x, L.light.position.z - P.z) < 16);
    if (!lights.length) return this.musicBox();
    const L = choice(lights);
    L.dead = rand(8, 15);
    this.g.audio.bulbPop({ x: L.light.position.x, y: 2.8, z: L.light.position.z });
    return null;
  }

  farFigure() {
    const P = this.info(), w = this.g.world;
    for (let i = 0; i < 8; i++) {
      const a = rand(-0.3, 0.3), c = Math.cos(a), s = Math.sin(a);
      const dx = P.fx * c - P.fz * s, dz = P.fx * s + P.fz * c;
      const free = w.freeDistance(P.x, P.z, dx, dz, 18);
      if (free < 10) continue;
      const d = rand(10, free - 0.5), x = P.x + dx * d, z = P.z + dz * d;
      const fig = this.figure.group;
      fig.position.set(x, 0, z); fig.rotation.set(0, Math.atan2(P.x - x, P.z - z), 0); fig.visible = true;
      return {
        step: (dt, t) => {
          this.figure.animate(dt, 0, 0);
          const pl = this.g.player, dist = Math.hypot(x - pl.pos.x, z - pl.pos.z);
          // Verschwindet, wenn man sie anleuchtet oder näher kommt
          const lit = pl.flashlightOn && this.inView(x, z, 0.985);
          if (lit || dist < 7 || t > 5) { if (lit) this.g.audio.whoosh({ x, y: 1.5, z }); return true; }
          return false;
        },
      };
    }
    return null;
  }

  chairTurn() {
    const P = this.info();
    const chairs = this.g.world.chairs.filter((c) => Math.hypot(c.x - P.x, c.z - P.z) < 15 && !this.inView(c.x, c.z, 0.2));
    if (!chairs.length) return this.knockFar();
    const c = choice(chairs);
    if (Math.random() < 0.6) c.mesh.rotation.set(0, Math.atan2(P.x - c.x, P.z - c.z), 0); // dreht sich zu dir
    else c.mesh.rotation.set(-Math.PI / 2 + 0.05, rand(0, 6.28), 0, 'YXZ');            // umgekippt
    if (Math.random() < 0.5) this.g.audio.scrape({ x: c.x, y: 0.4, z: c.z });
    return null;
  }

  musicBox() {
    const P = this.info(), a = rand(0, Math.PI * 2), d = rand(7, 14);
    this.g.audio.musicBox({ x: P.x + Math.cos(a) * d, y: 1, z: P.z + Math.sin(a) * d });
    return null;
  }

  knockFar() {
    const P = this.info(), a = rand(0, Math.PI * 2), d = rand(6, 12);
    this.g.audio.knock({ x: P.x + Math.cos(a) * d, y: 1.4, z: P.z + Math.sin(a) * d });
    return null;
  }

  stepsAbove() {
    const P = this.info(), a = rand(0, Math.PI * 2), pts = [];
    for (let i = 0; i < 8; i++) pts.push({ x: P.x + Math.cos(a) * (i - 4) * 1.2, y: 3.6, z: P.z + Math.sin(a) * (i - 4) * 1.2 });
    this.g.audio.stepsAt(pts, 0.5);
    return null;
  }
}
