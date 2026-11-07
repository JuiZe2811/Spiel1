// Harmlose Schreckmomente. Sie können niemals töten, nichts entfernen und das Kruzifix nicht verbrauchen.
import * as THREE from '../vendor/three.module.min.js';
import { rand, choice } from './util.js';
import { ShadowMan, Crawler, Child, Doll, Mannequin, EyePairs, WallHands, makeScareFaces } from './entities.js';

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
    // Andere Wesen – nicht der Geist
    const glow = game.tex.glow;
    this.shadowMan = new ShadowMan(glow); this.crawler = new Crawler(glow); this.child = new Child();
    this.doll = new Doll(); this.mannequinE = new Mannequin(); this.eyes = new EyePairs(glow); this.hands = new WallHands();
    this.entities = [this.shadowMan, this.crawler, this.child, this.doll, this.mannequinE];
    for (const e of this.entities) game.scene.add(e.group);
    game.scene.add(this.eyes.group, this.hands.group);
    this.box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), game.world.mats.crate);
    this.box.visible = false; game.scene.add(this.box);
    this.faces = makeScareFaces();
    this.recent = [];
    this.reset();
  }

  reset() {
    this.timer = 0;
    this.next = rand(8, 14);
    this.active = null;
    this.hideAll();
  }

  hideAll() {
    this.phantom.group.visible = false; this.shadow.group.visible = false; this.winFace.visible = false;
    this.g.flickerOverride = null;
    this.g.world.blackout = false;
    this.phantom.group.rotation.set(0, 0, 0);
    if (this.entities) {
      for (const e of this.entities) { e.hide(); e.group.rotation.set(0, 0, 0); e.group.position.y = 0; }
      this.eyes.hide(); this.hands.group.visible = false; this.box.visible = false; this.box.userData.hit = false;
    }
    this.g.ui.hideScareFace();
  }

  // Nächsten Schreckmoment bald auslösen (z. B. nach einem Schlüsselfund).
  soon(sec) { if (!this.active) this.next = Math.min(this.next, this.timer + sec); }

  // Mit jedem Schlüssel wird es hektischer.
  interval() {
    const k = this.g.keysCollected;
    return this.g.settings.reduceScares ? rand(28, 55) - k * 2 : Math.max(7, rand(10, 26) - k * 1.5);
  }

  update(dt) {
    if (this.active) {
      this.active.t += dt;
      if (this.active.step(dt, this.active.t) === true) {
        this.active = null; this.hideAll();
        // Manchmal folgt direkt ein zweiter Schock
        if (!this.g.settings.reduceScares && Math.random() < 0.3) this.next = this.timer + rand(1.5, 4);
      }
      return;
    }
    this.timer += dt;
    if (this.timer < this.next) return;
    const ghost = this.g.ghost, pl = this.g.player.pos;
    if (ghost.chasing || ghost.state === 'repel' || Math.hypot(ghost.pos.x - pl.x, ghost.pos.z - pl.z) < 8) { this.next = this.timer + 4; return; }
    this.trigger();
  }

  trigger(name) {
    const weights = {
      shadowPeek: 3, shadowWalk: 3, crawlerRush: 3, crawlerCross: 2, crawlerCeiling: 2, childCorner: 3, dollAppear: 2, mannequin: 2,
      eyesInDark: 3, wallHands: 2, objectThrow: 2, blackout: 2, flickerReveal: 2, behindYou: 2, faceFlash: 2, subliminal: 1,
      doorSlam: 2, windowFace: 1, whisper: 1, furnitureMove: 2, stepsBehind: 2, banging: 2, phoneRing: 1, giggle: 1, doorChain: 1,
      distantScream: 1, ghostGlimpse: 0.5,
    };
    let pick = name;
    if (!pick) {
      const opts = Object.entries(weights).filter(([n]) => !this.recent.includes(n));
      let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
      pick = opts[0][0];
      for (const [n, w] of opts) { r -= w; if (r <= 0) { pick = n; break; } }
    }
    this.recent.push(pick); if (this.recent.length > 10) this.recent.shift();
    this.timer = 0; this.next = this.interval();
    this.hideAll();
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
    model.group.rotation.set(0, 0, 0);
    if (faceToPlayer) model.group.rotation.y = Math.atan2(P.x - x, P.z - z);
    model.group.visible = true;
  }
  facePos(model) { const p = model.group.position; return { x: p.x, y: 1.6, z: p.z }; }

  // ---------- Umgebung (unverändert) ----------
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

  stepsBehind() {
    const P = this.playerInfo(), pts = [];
    for (let i = 0; i < 9; i++) {
      const d = 9 - i * 0.95;
      pts.push({ x: P.x - P.fx * d, y: 0.2, z: P.z - P.fz * d });
    }
    this.g.audio.stepsAt(pts, 0.32);
    return {
      step: (dt, t) => {
        if (t > 3.1 && t < 3.15) { this.g.audio.whisper({ x: P.x - P.fx * 0.6, y: 1.6, z: P.z - P.fz * 0.6 }); }
        return t > 4.6;
      },
    };
  }

  banging() {
    const P = this.playerInfo(), w = this.g.world;
    // Nächste Wand neben dem Spieler suchen
    let pos = null;
    for (const [dx, dz] of [[P.rx, P.rz], [-P.rx, -P.rz], [-P.fx, -P.fz], [P.fx, P.fz]]) {
      const d = w.freeDistance(P.x, P.z, dx, dz, 5);
      if (d < 5) { pos = { x: P.x + dx * (d + 0.3), y: 1.5, z: P.z + dz * (d + 0.3) }; break; }
    }
    if (!pos) pos = { x: P.x + P.rx * 3, y: 1.5, z: P.z + P.rz * 3 };
    const times = [0, 0.55, 1.1, 1.5, 1.8, 2.05, 2.25, 2.4];
    let i = 0;
    return {
      step: (dt, t) => {
        while (i < times.length && t >= times[i]) { this.g.audio.bang(pos, 0.5 + i * 0.07); if (i > 4) this.g.shake(0.08); i++; }
        return t > 2.8;
      },
    };
  }

  phoneRing() {
    const P = this.playerInfo();
    const reg = this.g.world.regions.filter((r) => r.zone === 'o')
      .map((r) => ({ x: this.g.world.center(Math.round(r.cx)), z: this.g.world.center(Math.round(r.cz)) }))
      .sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    const pos = reg ? { x: reg.x, y: 0.9, z: reg.z } : { x: P.x + 6, y: 0.9, z: P.z };
    this.g.audio.phoneRing(pos);
    this.g.makeNoise(pos.x, pos.z, 14);   // Auch der Geist hört es
    return { step: (dt, t) => t > 4.8 };
  }

  giggle() {
    const P = this.playerInfo(), a = rand(0, Math.PI * 2), d = rand(4, 9);
    this.g.audio.giggle({ x: P.x + Math.cos(a) * d, y: 1.0, z: P.z + Math.sin(a) * d });
    return { step: (dt, t) => t > 1.2 };
  }

  doorChain() {
    const P = this.playerInfo(), w = this.g.world;
    const doors = w.doors.slice().sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 4);
    let i = 0;
    return {
      step: (dt, t) => {
        if (i < doors.length && t >= i * 0.45) {
          const d = doors[i++];
          if (d.open && Math.hypot(d.x - P.x, d.z - P.z) > 1.2) w.setDoor(d, false, 0, 0, true);
          this.g.audio.doorSlam({ x: d.x, y: 1.2, z: d.z });
          this.g.shake(0.12);
        }
        return t > doors.length * 0.45 + 0.4;
      },
    };
  }

  distantScream() {
    const P = this.playerInfo(), a = rand(0, Math.PI * 2);
    this.g.audio.distantScream({ x: P.x + Math.cos(a) * 14, y: 1.5, z: P.z + Math.sin(a) * 14 });
    return { step: (dt, t) => t > 1.8 };
  }


  // ======================================================================
  // Neue Wesen – nichts davon ist der jagende Geist.
  // ======================================================================

  // Grauenhaftes Gesicht direkt vor der Kamera (verschiedene Fratzen; selten dein hochgeladenes)
  faceFlash() {
    const g = this.g, red = g.settings.reduceScares;
    const faces = [this.faces.grin, this.faces.eyeless, this.faces.screamer];
    const src = Math.random() < 0.2 ? null : faces[Math.floor(Math.random() * faces.length)];
    g.ui.showScareFace(red ? 0.55 : 1, src);
    g.audio.stinger(red ? 0.5 : 1);
    g.shake(red ? 0.1 : 0.4);
    return { step: (dt, t) => t > (red ? 0.25 : 0.5) };
  }

  // Schattenmann lugt aus einer offenen Tür oder steht am Ende des Flurs
  shadowPeek() {
    const P = this.playerInfo(), w = this.g.world;
    const doors = w.doors.filter((d) => d.open && Math.hypot(d.x - P.x, d.z - P.z) < 13 && Math.hypot(d.x - P.x, d.z - P.z) > 4
      && this.inView(d.x, d.z, 0.55) && w.lineOfSight(P.x, P.z, d.x, d.z));
    let pos;
    if (doors.length) {
      const d = choice(doors), dx = d.x - P.x, dz = d.z - P.z, l = Math.hypot(dx, dz);
      pos = { x: d.x + dx / l * 1.2, z: d.z + dz / l * 1.2 };
      if (!w.isWalkable(w.cell(pos.x), w.cell(pos.z))) pos = { x: d.x, z: d.z };
    } else {
      pos = this.spotInView(7, 14, 0.25);
      if (!pos) return this.eyesInDark();
    }
    const e = this.shadowMan;
    e.show(pos.x, pos.z, P.x, P.z); e.setEyes(true);
    e.group.rotation.z = rand(-0.25, 0.25); // schief geneigt
    this.g.audio.whisper({ x: pos.x, y: 2.4, z: pos.z });
    return {
      step: (dt, t) => {
        e.animate(dt);
        const pl = this.g.player, d = Math.hypot(pos.x - pl.pos.x, pos.z - pl.pos.z);
        const lit = pl.flashlightOn && this.inView(pos.x, pos.z, 0.97);
        if (d < 5 || t > 4 || (lit && t > 0.8)) { this.g.audio.whoosh({ x: pos.x, y: 2, z: pos.z }); return true; }
        return false;
      },
    };
  }

  // Schattenmann geht langsam quer durch den Raum, ohne dich zu beachten
  shadowWalk() {
    const lane = this.lateralLane(7, 13, 3);
    if (!lane) return this.whisper();
    const e = this.shadowMan;
    e.show(lane.start.x, lane.start.z); e.setEyes(Math.random() < 0.5);
    e.group.rotation.y = Math.atan2(lane.end.x - lane.start.x, lane.end.z - lane.start.z);
    const dur = lane.len / 1.3;
    const pts = []; for (let i = 0; i < Math.ceil(dur / 0.7); i++) pts.push({ x: lane.mid.x, y: 0.2, z: lane.mid.z });
    this.g.audio.stepsAt(pts, 0.7);
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        e.group.position.set(lane.start.x + (lane.end.x - lane.start.x) * k, 0, lane.start.z + (lane.end.z - lane.start.z) * k);
        e.animate(dt, 1);
        return t > dur;
      },
    };
  }

  // Krabbler rennt auf allen Vieren auf dich zu und verschwindet kurz vorher
  crawlerRush() {
    const g = this.g, red = g.settings.reduceScares;
    const s = this.spotInView(8, 13, 0.15);
    if (!s) return this.faceFlash();
    const c = this.crawler; c.show(s.x, s.z, g.player.pos.x, g.player.pos.z); c.group.position.y = 0;
    g.audio.growl({ x: s.x, y: 0.5, z: s.z });
    const stopAt = red ? 3.2 : 1.3;
    return {
      step: (dt, t) => {
        const p = c.group.position, pl = g.player.pos;
        const dx = pl.x - p.x, dz = pl.z - p.z, d = Math.hypot(dx, dz);
        if (t > 0.6) {
          p.x += dx / d * 10 * dt; p.z += dz / d * 10 * dt;
          c.group.rotation.y = Math.atan2(dx, dz);
          c.animate(dt, 10);
          if (Math.random() < dt * 12) g.audio.ghostStep({ x: p.x, y: 0.2, z: p.z });
        } else c.animate(dt, 0);
        if (d < stopAt || t > 3) { g.audio.stinger(red ? 0.45 : 1); g.ui.flash(red ? 0.15 : 0.45); g.shake(red ? 0.1 : 0.35); return true; }
        return false;
      },
    };
  }

  // Krabbler huscht über den Boden
  crawlerCross() {
    const lane = this.lateralLane(5, 11, 2.5);
    if (!lane) return this.doorSlam();
    const c = this.crawler; c.show(lane.start.x, lane.start.z);
    c.group.rotation.y = Math.atan2(lane.end.x - lane.start.x, lane.end.z - lane.start.z);
    const dur = lane.len / 8;
    this.g.audio.runSteps({ x: lane.mid.x, y: 0.2, z: lane.mid.z }, Math.ceil(dur / 0.08));
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        c.group.position.set(lane.start.x + (lane.end.x - lane.start.x) * k, 0, lane.start.z + (lane.end.z - lane.start.z) * k);
        c.animate(dt, 8);
        return t > dur;
      },
    };
  }

  // Krabbler läuft kopfüber an der Decke über dich hinweg
  crawlerCeiling() {
    const P = this.playerInfo(), w = this.g.world;
    const start = { x: P.x + P.fx * 6, z: P.z + P.fz * 6 }, end = { x: P.x - P.fx * 5, z: P.z - P.fz * 5 };
    if (!w.isOpen(w.cell(start.x), w.cell(start.z)) || !w.isOpen(w.cell(end.x), w.cell(end.z))) return this.crawlerCross();
    const c = this.crawler; c.show(start.x, start.z);
    c.group.rotation.set(Math.PI, Math.atan2(end.x - start.x, end.z - start.z), 0, 'YXZ');
    c.group.position.y = 2.98;
    this.g.audio.runSteps({ x: P.x, y: 3, z: P.z }, 10);
    const dur = 1.6;
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        c.group.position.set(start.x + (end.x - start.x) * k, 2.98, start.z + (end.z - start.z) * k);
        c.animate(dt, 7);
        if (t > 0.6 && t - dt <= 0.6) this.g.audio.giggle({ x: P.x, y: 2.9, z: P.z });
        return t > dur;
      },
    };
  }

  // Ein Kind starrt in der Ecke zur Wand – und dreht dann den Kopf ganz herum
  childCorner() {
    const g = this.g;
    const s = this.spotInView(5, 9, 0.3);
    if (!s) return this.giggle();
    const c = this.child;
    const P = this.playerInfo();
    c.show(s.x, s.z, P.x, P.z);
    c.group.rotation.y += Math.PI; // Rücken zum Spieler
    c.head.rotation.y = 0;
    let turned = 0;
    g.audio.crying({ x: s.x, y: 1, z: s.z });
    return {
      step: (dt, t) => {
        c.animate(dt);
        const pl = g.player.pos, d = Math.hypot(s.x - pl.x, s.z - pl.z);
        if (!turned && (d < 4 || t > 3.5)) { turned = t; g.audio.giggle({ x: s.x, y: 1.1, z: s.z }); }
        if (turned) {
          c.head.rotation.y = Math.min(Math.PI, (t - turned) * 2.2);       // ganz langsam herumdrehen
          if (t - turned > 1.6) { g.flickerOverride = 0.02; if (t - turned > 1.9) { g.audio.stinger(g.settings.reduceScares ? 0.45 : 0.8); return true; } }
        }
        return t > 9;
      },
    };
  }

  // Eine Puppe sitzt plötzlich hinter dir und dreht den Kopf zu dir
  dollAppear() {
    const P = this.playerInfo(), w = this.g.world;
    const x = P.x - P.fx * 1.6 + P.rx * rand(-0.4, 0.4), z = P.z - P.fz * 1.6 + P.rz * rand(-0.4, 0.4);
    if (!w.isOpen(w.cell(x), w.cell(z))) return this.whisper();
    const d = this.doll;
    d.show(x, z, P.x, P.z);
    d.group.rotation.y += rand(-1.2, 1.2);
    d.head.rotation.y = 0;
    this.g.audio.musicBox({ x, y: 0.4, z });
    let seen = 0;
    return {
      step: (dt, t) => {
        const pl = this.g.player.pos;
        const look = Math.atan2(pl.x - x, pl.z - z) - d.group.rotation.y;
        if (!seen && this.inView(x, z, 0.6)) seen = t;
        if (seen) d.head.rotation.y += (look - d.head.rotation.y) * Math.min(1, dt * 2);
        if (seen && t - seen > 2.2) { this.g.audio.giggle({ x, y: 0.4, z }); return true; }
        return t > 12;
      },
    };
  }

  // Schaufensterpuppe kommt näher – aber nur, wenn du nicht hinsiehst
  mannequin() {
    const g = this.g;
    const s = this.spotInView(8, 12, 0.2);
    if (!s) return this.shadowWalk();
    const m = this.mannequinE, w = g.world;
    let pos = { x: s.x, z: s.z };
    m.show(pos.x, pos.z, g.player.pos.x, g.player.pos.z);
    let wasSeen = true, moves = 0;
    return {
      step: (dt, t) => {
        const pl = g.player.pos, seenNow = this.inView(pos.x, pos.z, 0.55);
        const d = Math.hypot(pos.x - pl.x, pos.z - pl.z);
        if (!seenNow && wasSeen && d > 2.2) {
          // Ein Stück näher rücken und den Kopf anders neigen
          const step = Math.min(2.2, d - 1.6), nx = pos.x + (pl.x - pos.x) / d * step, nz = pos.z + (pl.z - pos.z) / d * step;
          if (w.isOpen(w.cell(nx), w.cell(nz))) { pos = { x: nx, z: nz }; moves++; g.audio.scrape({ x: nx, y: 0.3, z: nz }); }
          m.show(pos.x, pos.z, pl.x, pl.z);
          m.group.rotation.z = rand(-0.12, 0.12);
        }
        wasSeen = seenNow;
        if (seenNow && d < 2.6 && moves > 0) { g.audio.stinger(g.settings.reduceScares ? 0.45 : 1); g.shake(0.3); return true; }
        return t > 25;
      },
    };
  }

  // Rote Augenpaare im Dunkeln, die verschwinden, wenn man sie anleuchtet
  eyesInDark() {
    const P = this.playerInfo(), w = this.g.world, E = this.eyes;
    let n = 0;
    for (const p of E.pairs) {
      const a = Math.atan2(P.fx, P.fz) + rand(-1.1, 1.1), dx = Math.sin(a), dz = Math.cos(a);
      const free = w.freeDistance(P.x, P.z, dx, dz, 14);
      if (free < 4) continue;
      const d = rand(3.5, free - 0.3);
      p.position.set(P.x + dx * d, rand(0.3, 2.4), P.z + dz * d);
      p.lookAt(this.g.camera.position);
      p.visible = true; p.userData.t = rand(0, 1.2); n++;
    }
    if (!n) return this.whisper();
    this.g.audio.whisper(null);
    return {
      step: (dt, t) => {
        const pl = this.g.player;
        for (const p of E.pairs) {
          if (!p.visible) continue;
          p.scale.y = (Math.sin((t + p.userData.t) * 3) > 0.95) ? 0.1 : 1; // blinzeln
          if (pl.flashlightOn && this.inView(p.position.x, p.position.z, 0.95)) p.visible = false;
        }
        return t > 6 || E.pairs.every((p) => !p.visible);
      },
    };
  }

  // Schwarze Arme greifen neben dir aus der Wand
  wallHands() {
    const P = this.playerInfo(), w = this.g.world;
    let hit = null;
    for (const [dx, dz] of [[P.rx, P.rz], [-P.rx, -P.rz], [P.fx, P.fz]]) {
      const d = w.freeDistance(P.x, P.z, dx, dz, 3.5);
      if (d < 3.4) { hit = { x: P.x + dx * (d + 0.35), z: P.z + dz * (d + 0.35), nx: -dx, nz: -dz }; break; }
    }
    if (!hit) return this.banging();
    const H = this.hands;
    H.group.visible = true;
    H.arms.forEach((a, i) => {
      a.position.set(hit.x + hit.nz * (i - 2) * 0.35, rand(0.6, 2.2), hit.z - hit.nx * (i - 2) * 0.35);
      a.rotation.set(rand(-0.3, 0.3), Math.atan2(hit.nx, hit.nz) + rand(-0.3, 0.3), 0);
      a.scale.z = 0.01; a.userData.delay = i * 0.12;
    });
    this.g.audio.scrape({ x: hit.x, y: 1.4, z: hit.z });
    this.g.audio.whisper({ x: hit.x, y: 1.6, z: hit.z });
    return {
      step: (dt, t) => {
        H.arms.forEach((a) => {
          const k = t - a.userData.delay;
          a.scale.z = Math.max(0.01, k < 0.6 ? k / 0.6 : k < 1.6 ? 1 + Math.sin(k * 12) * 0.03 : 1 - (k - 1.6) * 4);
        });
        if (t > 0.5 && t - dt <= 0.5) this.g.audio.stinger(this.g.settings.reduceScares ? 0.4 : 0.7);
        return t > 2.3;
      },
    };
  }

  // Eine Kiste fliegt durch den Raum und kracht gegen die Wand
  objectThrow() {
    const lane = this.lateralLane(3, 7, 2);
    if (!lane) return this.banging();
    const box = this.box; box.visible = true;
    box.position.set(lane.start.x, 1.2, lane.start.z);
    const dur = lane.len / 11;
    return {
      step: (dt, t) => {
        const k = Math.min(1, t / dur);
        box.position.set(lane.start.x + (lane.end.x - lane.start.x) * k, 1.2 + Math.sin(k * Math.PI) * 0.6, lane.start.z + (lane.end.z - lane.start.z) * k);
        box.rotation.x += dt * 9; box.rotation.y += dt * 7;
        if (k >= 1 && !box.userData.hit) { box.userData.hit = true; this.g.audio.bang({ x: lane.end.x, y: 1.2, z: lane.end.z }, 1); this.g.shake(0.2); }
        if (k >= 1) box.position.y = Math.max(0.2, box.position.y - dt * 6);
        return t > dur + 0.8;
      },
    };
  }

  // Stromausfall – und wenn das Licht zurückkommt, steht der Schattenmann vor dir
  blackout() {
    const g = this.g, w = g.world;
    w.blackout = true;
    g.audio.bang({ x: g.player.pos.x, y: 3, z: g.player.pos.z }, 0.5);
    let shown = false, spot = null;
    const e = this.shadowMan;
    return {
      step: (dt, t) => {
        g.flickerOverride = t < 2.6 ? 0 : (t < 2.9 ? (Math.random() < 0.5 ? 1 : 0) : null);
        if (t > 0.6 && t - dt <= 0.6) g.audio.whisper(null);
        if (!shown && t > 2.6) {
          shown = true; w.blackout = false;
          spot = this.spotInView(1.7, 2.6, 0.08);
          if (spot) { e.show(spot.x, spot.z, g.player.pos.x, g.player.pos.z); e.setEyes(true); g.audio.stinger(g.settings.reduceScares ? 0.5 : 1); g.shake(0.3); }
        }
        if (e.group.visible) e.animate(dt);
        if (t > 3.2) e.hide();
        return t > 3.3;
      },
    };
  }

  // Im Taschenlampen-Flackern steht für einen Moment etwas direkt vor dir
  flickerReveal() {
    const g = this.g;
    const s = this.spotInView(2.6, 4.2, 0.12);
    const e = choice([this.shadowMan, this.mannequinE, this.child]);
    return {
      step: (dt, t) => {
        const on = t < 0.3 ? Math.random() > 0.5 : t < 0.7 ? false : t < 1.05 ? true : t < 1.35 ? false : t < 1.6 ? Math.random() > 0.6 : true;
        g.flickerOverride = t < 1.6 ? (on ? 1 : 0.02) : null;
        if (s) {
          const vis = t >= 0.7 && t < 1.05;
          if (vis && !e.group.visible) { e.show(s.x, s.z, g.player.pos.x, g.player.pos.z); if (e === this.child) e.head.rotation.y = 0; if (e.setEyes) e.setEyes(true); g.audio.stinger(g.settings.reduceScares ? 0.35 : 0.75); }
          if (!vis) e.hide();
        }
        return t > 1.7;
      },
    };
  }

  // Etwas steht hinter dir – wenn du dich umdrehst, ist es da (Kind oder Schaufensterpuppe)
  behindYou() {
    const P = this.playerInfo(), w = this.g.world;
    const x = P.x - P.fx * 2.0, z = P.z - P.fz * 2.0;
    if (!w.isOpen(w.cell(x), w.cell(z)) || !w.lineOfSight(P.x, P.z, x, z)) return this.stepsBehind();
    const e = Math.random() < 0.5 ? this.child : this.mannequinE;
    e.show(x, z, P.x, P.z);
    if (e === this.child) e.head.rotation.y = 0;
    this.g.audio.breath();
    this.g.audio.whisper({ x, y: 1.4, z });
    this.g.ui.message('… hinter dir …', 2);
    let seen = 0;
    return {
      step: (dt, t) => {
        if (!seen && this.inView(x, z, 0.55)) { seen = t; this.g.audio.stinger(this.g.settings.reduceScares ? 0.5 : 1); this.g.shake(0.35); }
        if (seen) return t - seen > 0.45;
        return t > 7;
      },
    };
  }

  // Ganz selten: Ein kurzer Blick auf den echten Geist in der Ferne – er verschwindet sofort
  ghostGlimpse() {
    const s = this.spotInView(10, 15, 0.2);
    if (!s) return this.eyesInDark();
    this.place(this.phantom, s.x, s.z);
    return { step: (dt, t) => { this.phantom.animate(dt, 0, 0); return t > 0.6; } };
  }

  // Unterschwellige Fratzen-Blitze
  subliminal() {
    const g = this.g, red = g.settings.reduceScares;
    const flashes = red ? [0.1] : [0.05, 0.4, 0.62];
    const faces = [this.faces.grin, this.faces.eyeless, this.faces.screamer];
    let i = 0, off = -1;
    g.audio.whoosh(null);
    return {
      step: (dt, t) => {
        if (i < flashes.length && t >= flashes[i]) { g.ui.showScareFace(red ? 0.35 : 0.6, faces[i % faces.length]); g.flickerOverride = 0.05; off = t + 0.07; i++; }
        if (off > 0 && t > off) { g.ui.hideScareFace(); g.flickerOverride = null; off = -1; }
        return t > 0.9;
      },
    };
  }

  // Hilfsfunktion: freie Querbahn im Blickfeld
  lateralLane(dmin, dmax, minLen) {
    const w = this.g.world;
    const s = this.spotInView(dmin, dmax, 0.2);
    if (!s) return null;
    const rx = -s.dz, rz = s.dx;
    const ext = (sign) => { let e = 0; while (e < 5 && w.isWalkable(w.cell(s.x + rx * sign * (e + 0.4)), w.cell(s.z + rz * sign * (e + 0.4)))) e += 0.4; return e; };
    const a = ext(-1), b = ext(1);
    if (a + b < minLen) return null;
    const dir = Math.random() < 0.5 ? 1 : -1;
    return { start: { x: s.x - rx * a * dir, z: s.z - rz * a * dir }, end: { x: s.x + rx * b * dir, z: s.z + rz * b * dir }, mid: { x: s.x, z: s.z }, len: a + b };
  }
}
