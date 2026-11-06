// Harmlose Schreckmomente. Sie können niemals töten, nichts entfernen und das Kruzifix nicht verbrauchen.
import * as THREE from '../vendor/three.module.min.js';
import { rand, choice } from './util.js';

export class ScareDirector {
  constructor(game, phantom, shadow) {
    this.g = game;
    this.phantom = phantom;   // sieht exakt aus wie der echte Geist
    this.shadow = shadow;     // schwarze Schattengestalt
    phantom.group.visible = false; shadow.group.visible = false;
    game.scene.add(phantom.group, shadow.group);
    this.winFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72),
      new THREE.MeshBasicMaterial({ map: game.face.texture, transparent: true, opacity: 0.8, color: 0x9aa4aa }));
    this.winFace.visible = false;
    game.scene.add(this.winFace);
    this.recent = [];
    this.reset();
  }

  reset() {
    this.timer = 0;
    this.next = rand(14, 24);
    this.active = null;
    this.hideAll();
  }

  hideAll() {
    this.phantom.group.visible = false; this.shadow.group.visible = false; this.winFace.visible = false;
    this.g.flickerOverride = null;
    this.g.ui.hideScareFace();
  }

  interval() { return this.g.settings.reduceScares ? rand(35, 80) : rand(20, 60); }

  update(dt) {
    if (this.active) {
      this.active.t += dt;
      if (this.active.step(dt, this.active.t) === true) { this.active = null; this.hideAll(); }
      return;
    }
    this.timer += dt;
    if (this.timer < this.next) return;
    const ghost = this.g.ghost, pl = this.g.player.pos;
    if (ghost.chasing || ghost.state === 'repel' || Math.hypot(ghost.pos.x - pl.x, ghost.pos.z - pl.z) < 10) { this.next = this.timer + 4; return; }
    this.trigger();
  }

  trigger(name) {
    const all = ['faceFlash', 'doorFigure', 'shadowRun', 'flickerReveal', 'doorSlam', 'rushGhost', 'windowFace', 'whisper', 'floatAcross', 'furnitureMove'];
    const options = all.filter((n) => !this.recent.includes(n));
    const pick = name || choice(options);
    this.recent.push(pick); if (this.recent.length > 4) this.recent.shift();
    this.timer = 0; this.next = this.interval();
    const ev = this[pick]();
    if (ev) { ev.t = 0; ev.name = pick; this.active = ev; }
  }

  // ---------- Hilfsfunktionen ----------
  get cam() { return this.g.camera; }
  playerInfo() {
    const p = this.g.player;
    const f = p.forward();
    return { x: p.pos.x, z: p.pos.z, fx: f.x, fz: f.z, rx: -f.z, rz: f.x };
  }
  // Freier Punkt im Blickfeld in Distanz [dmin, dmax]
  spotInView(dmin, dmax, spread = 0.35) {
    const P = this.playerInfo(), w = this.g.world;
    for (let i = 0; i < 10; i++) {
      const a = rand(-spread, spread), c = Math.cos(a), s = Math.sin(a);
      const dx = P.fx * c - P.fz * s, dz = P.fx * s + P.fz * c;
      const free = w.freeDistance(P.x, P.z, dx, dz, dmax);
      if (free >= dmin) {
        const d = rand(dmin, Math.min(dmax, free - 0.4));
        return { x: P.x + dx * d, z: P.z + dz * d, dx, dz, d };
      }
    }
    return null;
  }
  inView(x, z, minDot = 0.5) {
    const P = this.playerInfo(), dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz) || 1;
    return (dx * P.fx + dz * P.fz) / d > minDot;
  }
  place(model, x, z, faceToPlayer = true) {
    const P = this.playerInfo();
    model.group.position.set(x, 0, z);
    if (faceToPlayer) model.group.rotation.y = Math.atan2(P.x - x, P.z - z);
    model.group.visible = true;
  }
  facePos(model) { const p = model.group.position; return { x: p.x, y: 1.6, z: p.z }; }

  // ---------- Die zehn Ereignisse ----------
  faceFlash() {
    const g = this.g, red = g.settings.reduceScares;
    g.ui.showScareFace(red ? 0.55 : 1);
    g.audio.stinger(red ? 0.5 : 1);
    g.shake(red ? 0.1 : 0.35);
    return { step: (dt, t) => t > (red ? 0.25 : 0.45) };
  }

  doorFigure() {
    const P = this.playerInfo(), w = this.g.world;
    const doors = w.doors.filter((d) => d.open && Math.hypot(d.x - P.x, d.z - P.z) < 13 && Math.hypot(d.x - P.x, d.z - P.z) > 4
      && this.inView(d.x, d.z, 0.55) && w.lineOfSight(P.x, P.z, d.x, d.z));
    let pos;
    if (doors.length) {
      const d = choice(doors);
      const dx = d.x - P.x, dz = d.z - P.z, l = Math.hypot(dx, dz);
      pos = { x: d.x + dx / l * 1.3, z: d.z + dz / l * 1.3 };
      if (!w.isWalkable(w.cell(pos.x), w.cell(pos.z))) pos = { x: d.x, z: d.z };
    } else {
      pos = this.spotInView(6, 13, 0.25);
      if (!pos) return this.whisper();
    }
    this.place(this.phantom, pos.x, pos.z);
    this.g.audio.moan(this.facePos(this.phantom), 0.25);
    return {
      step: (dt, t) => {
        this.phantom.animate(dt, 0, 0);
        const near = Math.hypot(pos.x - this.g.player.pos.x, pos.z - this.g.player.pos.z) < 4.5;
        if (near || t > 3.2) { this.g.audio.whoosh(this.facePos(this.phantom)); return true; }
        return false;
      },
    };
  }

  shadowRun() {
    const P = this.playerInfo(), w = this.g.world;
    const s = this.spotInView(5, 12, 0.2);
    if (!s) return this.doorSlam();
    const rx = -s.dz, rz = s.dx;
    const ext = (sign) => { let e = 0; while (e < 5 && w.isWalkable(w.cell(s.x + rx * sign * (e + 0.4)), w.cell(s.z + rz * sign * (e + 0.4)))) e += 0.4; return e; };
    const a = ext(-1), b = ext(1);
    if (a + b < 2) return this.whisper();
    const start = { x: s.x - rx * a, z: s.z - rz * a }, end = { x: s.x + rx * b, z: s.z + rz * b };
    const len = a + b, dur = len / 6.5;
    this.place(this.shadow, start.x, start.z, false);
    this.shadow.group.rotation.y = Math.atan2(rx, rz);
    this.g.audio.runSteps({ x: s.x, y: 0.5, z: s.z }, Math.ceil(dur / 0.15));
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        this.shadow.group.position.set(start.x + (end.x - start.x) * k, 0, start.z + (end.z - start.z) * k);
        this.shadow.animate(dt, 0.2, 6);
        return t > dur;
      },
    };
  }

  flickerReveal() {
    const g = this.g;
    const s = this.spotInView(2.8, 4.5, 0.12);
    return {
      step: (dt, t) => {
        // Muster: aus/an/aus ... Figur nur während eines kurzen Lichtblitzes sichtbar
        const on = t < 0.3 ? Math.random() > 0.5 : t < 0.7 ? false : t < 1.05 ? true : t < 1.35 ? false : t < 1.6 ? Math.random() > 0.6 : true;
        g.flickerOverride = t < 1.6 ? (on ? 1 : 0.02) : null;
        if (s) {
          const vis = t >= 0.7 && t < 1.05;
          if (vis && !this.phantom.group.visible) { this.place(this.phantom, s.x, s.z); g.audio.stinger(g.settings.reduceScares ? 0.35 : 0.7); }
          this.phantom.group.visible = vis;
          if (vis) this.phantom.animate(dt, 1, 0);
        }
        return t > 1.7;
      },
    };
  }

  doorSlam() {
    const P = this.playerInfo(), w = this.g.world;
    const doors = w.doors.filter((d) => d.open && Math.hypot(d.x - P.x, d.z - P.z) < 15 && Math.hypot(d.x - P.x, d.z - P.z) > 2);
    let pos;
    if (doors.length) {
      const d = choice(doors);
      w.setDoor(d, false, 0, 0, true);
      pos = { x: d.x, y: 1.2, z: d.z };
    } else {
      const near = w.doors.slice().sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
      pos = near ? { x: near.x, y: 1.2, z: near.z } : { x: P.x - P.fx * 6, y: 1.2, z: P.z - P.fz * 6 };
    }
    this.g.audio.doorSlam(pos);
    this.g.shake(0.15);
    return { step: (dt, t) => t > 0.6 };
  }

  rushGhost() {
    const g = this.g, red = g.settings.reduceScares;
    const s = this.spotInView(8, 12, 0.15);
    if (!s) return this.faceFlash();
    this.place(this.phantom, s.x, s.z);
    g.audio.moan(this.facePos(this.phantom), 0.5);
    const stopAt = red ? 3.2 : 1.4;
    return {
      step: (dt, t) => {
        const p = this.phantom.group.position, pl = g.player.pos;
        const dx = pl.x - p.x, dz = pl.z - p.z, d = Math.hypot(dx, dz);
        if (t > 0.5) {
          const sp = 9 * dt;
          p.x += dx / d * sp; p.z += dz / d * sp;
          this.phantom.group.rotation.y = Math.atan2(dx, dz);
          this.phantom.animate(dt, 1, 9);
        } else this.phantom.animate(dt, 0.3, 0);
        if (d < stopAt || t > 3) {
          g.audio.stinger(red ? 0.45 : 1);
          g.ui.flash(red ? 0.15 : 0.45);
          g.shake(red ? 0.1 : 0.3);
          return true;
        }
        return false;
      },
    };
  }

  windowFace() {
    const P = this.playerInfo();
    const wins = this.g.world.windows.filter((w) => {
      const d = Math.hypot(w.x - P.x, w.z - P.z);
      return d < 14 && d > 2.5 && this.inView(w.x, w.z, 0.35) && (w.nx * (P.x - w.x) + w.nz * (P.z - w.z)) > 0;
    });
    if (!wins.length) return this.whisper();
    const w = choice(wins);
    const m = this.winFace;
    m.position.set(w.x, w.y, w.z);
    m.rotation.set(0, Math.atan2(w.nx, w.nz), 0);
    m.visible = true;
    this.g.audio.knock({ x: w.x, y: w.y, z: w.z });
    return {
      step: (dt, t) => {
        m.material.opacity = 0.8 * Math.min(1, t * 3) * (t > 1.4 ? Math.max(0, 1 - (t - 1.4) * 4) : 1);
        return t > 1.7;
      },
    };
  }

  whisper() {
    const P = this.playerInfo();
    this.g.audio.whisper({ x: P.x - P.fx * 0.8 + P.rx * rand(-0.4, 0.4), y: 1.6, z: P.z - P.fz * 0.8 + P.rz * rand(-0.4, 0.4) });
    return { step: (dt, t) => t > 2 };
  }

  floatAcross() {
    const w = this.g.world;
    const s = this.spotInView(4, 9, 0.2);
    if (!s) return this.whisper();
    const rx = -s.dz, rz = s.dx;
    const ext = (sign) => { let e = 0; while (e < 4.5 && w.isOpen(w.cell(s.x + rx * sign * (e + 0.4)), w.cell(s.z + rz * sign * (e + 0.4)))) e += 0.4; return e; };
    const a = ext(-1), b = ext(1);
    if (a + b < 2) return this.whisper();
    const dir = Math.random() < 0.5 ? 1 : -1;
    const start = { x: s.x - rx * a * dir, z: s.z - rz * a * dir }, end = { x: s.x + rx * b * dir, z: s.z + rz * b * dir };
    const dur = (a + b) / 4;
    this.place(this.phantom, start.x, start.z, false);
    this.phantom.group.rotation.y = Math.atan2(rx * dir, rz * dir);
    this.g.audio.moan({ x: s.x, y: 1.8, z: s.z }, 0.35);
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        this.phantom.group.position.set(start.x + (end.x - start.x) * k, 0.35 + Math.sin(k * Math.PI) * 0.2, start.z + (end.z - start.z) * k);
        this.phantom.animate(dt, 0.6, 4);
        return t > dur;
      },
    };
  }

  furnitureMove() {
    const P = this.playerInfo();
    const chairs = this.g.world.chairs.filter((c) => Math.hypot(c.x - P.x, c.z - P.z) < 11 && Math.hypot(c.x - P.x, c.z - P.z) > 2.5)
      .sort((a, b) => (this.inView(b.x, b.z, 0.4) ? 1 : 0) - (this.inView(a.x, a.z, 0.4) ? 1 : 0));
    if (!chairs.length) return this.doorSlam();
    const c = chairs[0];
    const ang = rand(0, Math.PI * 2), sx = c.x, sz = c.z;
    let tx = sx + Math.cos(ang) * 0.9, tz = sz + Math.sin(ang) * 0.9;
    const w = this.g.world;
    if (!w.isWalkable(w.cell(tx), w.cell(tz))) { tx = sx; tz = sz; }
    const r0 = c.mesh.rotation.y, tip = Math.random() < 0.5;
    this.g.audio.scrape({ x: sx, y: 0.4, z: sz });
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / 0.6);
        c.x = sx + (tx - sx) * k; c.z = sz + (tz - sz) * k;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = r0 + k * 2.2;
        if (tip && t > 0.6) c.mesh.rotation.x = -Math.min(1, (t - 0.6) / 0.15) * (Math.PI / 2 - 0.05);
        return t > 0.9;
      },
    };
  }
}
