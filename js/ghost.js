import * as THREE from '../vendor/three.module.min.js';
import { clamp, rand, angleDiff } from './util.js';

let GEO = null;
function geometries() {
  if (GEO) return GEO;
  const profile = [[0.44, 0], [0.4, 0.25], [0.32, 0.65], [0.25, 1.05], [0.22, 1.3], [0.16, 1.44], [0.08, 1.5], [0.02, 1.52]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(profile, 14);
  // Ausgefranster Saum
  const pos = robe.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.01) pos.setY(i, Math.random() * 0.28);
  robe.computeVertexNormals();
  const head = new THREE.SphereGeometry(0.17, 16, 12);
  const face = new THREE.SphereGeometry(0.173, 20, 14, Math.PI / 2 - 0.95, 1.9, 0.5, 1.95);
  const hair = new THREE.SphereGeometry(0.182, 14, 10, -Math.PI / 2 - (Math.PI + 0.3) / 2, Math.PI + 0.3, 0, 2.3);
  const strand = new THREE.PlaneGeometry(0.07, 0.85); strand.translate(0, -0.42, 0);
  const arm = new THREE.CylinderGeometry(0.035, 0.045, 0.62, 6); arm.translate(0, -0.31, 0);
  const hand = new THREE.SphereGeometry(1, 6, 5);
  GEO = { robe, head, face, hair, strand, arm, hand };
  return GEO;
}

export function createGhostMaterials(faceTex) {
  return {
    robe: new THREE.MeshLambertMaterial({ color: 0x9ba6ad, emissive: 0x18212a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    skin: new THREE.MeshLambertMaterial({ color: 0xc6cdcf, emissive: 0x1d262c }),
    hair: new THREE.MeshLambertMaterial({ color: 0x060606, side: THREE.DoubleSide }),
    face: new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, color: 0xc4ccd0 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  };
}

// 3D-Modell des Geistes (wird für den echten Geist und für harmlose Erscheinungen verwendet).
export class GhostModel {
  constructor(mats, shadow = false) {
    const G = geometries();
    const m = (k) => (shadow ? mats.shadow : mats[k]);
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(G.robe, m('robe'));
    this.group.add(this.body);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.66, 0.02);
    this.head.scale.setScalar(1.3);
    this.head.add(new THREE.Mesh(G.head, m('skin')));
    if (!shadow) { this.faceMesh = new THREE.Mesh(G.face, mats.face); this.head.add(this.faceMesh); }
    this.head.add(new THREE.Mesh(G.hair, m('hair')));
    for (let i = 0; i < 9; i++) {
      const a = -0.05 + (i / 8) * (Math.PI + 0.1);
      const s = new THREE.Mesh(G.strand, m('hair'));
      s.position.set(Math.cos(a) * 0.175, 0.05, -Math.sin(a) * 0.175);
      s.rotation.y = a + Math.PI / 2;
      s.scale.y = 0.8 + Math.random() * 0.5;
      this.head.add(s);
    }
    this.group.add(this.head);
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 1.42, 0);
      pivot.add(new THREE.Mesh(G.arm, m('skin')));
      const hand = new THREE.Mesh(G.hand, m('skin'));
      hand.scale.set(0.045, 0.1, 0.03); hand.position.y = -0.68;
      pivot.add(hand);
      this.group.add(pivot);
      this.arms.push(pivot);
    }
    this.t = Math.random() * 10;
    this.group.traverse((o) => { o.frustumCulled = true; });
  }
  animate(dt, reach = 0, speed = 0) {
    this.t += dt;
    const t = this.t;
    this.body.position.y = 0.12 + Math.sin(t * 2.1) * 0.05;
    this.head.position.y = 1.66 + this.body.position.y - 0.12;
    this.body.rotation.z = Math.sin(t * 1.3) * 0.04;
    this.body.rotation.x = clamp(speed * 0.05, 0, 0.25);
    this.head.rotation.z = 0.22 + Math.sin(t * 0.7) * 0.08;
    this.head.rotation.x = Math.sin(t * 0.9) * 0.05;
    this.arms.forEach((a, i) => {
      const target = -0.15 - reach * 1.3 + Math.sin(t * 1.7 + i) * 0.08;
      a.rotation.x += (target - a.rotation.x) * Math.min(1, dt * 6);
      a.rotation.z = (i ? 1 : -1) * (0.12 - reach * 0.08);
      a.position.y = 1.42 + this.body.position.y - 0.12;
    });
  }
}

const SPEED = { wander: 1.4, investigate: 2.5, chase: 3.7, search: 2.1, repel: 5.5, idle: 0 };

// Gegner-KI: wandern, Geräuschen nachgehen, entdecken, verfolgen, suchen, zurückweichen.
export class Ghost {
  constructor(game, model) {
    this.g = game;
    this.model = model;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.reset(0, 0);
  }

  reset(x, z) {
    this.pos.set(x, 0, z);
    if (!Number.isFinite(this.heading)) this.heading = 0;
    this.state = 'wander';
    this.path = null; this.pi = 0;
    this.awareness = 0;
    this.sees = false;
    this.visT = 0; this.repathT = 0; this.stateT = 0; this.lostT = 0;
    this.ignoreT = 0; this.senseT = 12;
    this.lastKnown = null;
    this.searchPts = 0;
    this.stuckT = 0; this.stuckRef = { x, z };
    this.waitT = 0;
    this.speedNow = 0;
    this.model.group.position.copy(this.pos);
  }

  get chasing() { return this.state === 'chase'; }

  setState(s) {
    if (this.state === s) return;
    const prev = this.state;
    this.state = s; this.stateT = 0; this.path = null; this.waitT = 0;
    if (s === 'chase' && prev !== 'chase') this.g.onGhostSpotted();
  }

  goTo(x, z) {
    const p = this.g.world.findPath(this.pos.x, this.pos.z, x, z);
    this.path = p && p.length ? p : null; this.pi = 0;
    return !!this.path;
  }

  hearNoise(x, z, radius) {
    if (this.state === 'chase' || this.state === 'repel' || this.ignoreT > 0) return;
    let d = Math.hypot(x - this.pos.x, z - this.pos.z);
    if (!this.g.world.lineOfSight(this.pos.x, this.pos.z, x, z)) d *= 1.6; // Wände dämpfen
    if (d > radius) return;
    this.setState('investigate');
    this.goTo(x, z);
  }

  repel() {
    const p = this.g.player.pos;
    this.setState('repel');
    const far = this.g.world.randomWalkable((q) => Math.hypot(q.x - p.x, q.z - p.z) > 16);
    this.goTo(far.x, far.z);
    this.awareness = 0;
    this.g.audio.ghostShriek(this.pos);
  }

  _perceive(dt) {
    const pl = this.g.player, world = this.g.world;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let range = (pl.flashlightOn ? 19 : 10) * (1 + this.g.keysCollected * 0.06) * (this.g.hunting ? 1.2 : 1);
    if (pl.crouching) range *= 0.65;
    if (pl.sprinting) range *= 1.15;
    if (this.g.finalPhase) range *= 1.25;
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 0.12;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const inFov = dist < 2.4 || (dx * fx + dz * fz) / (dist || 1) > 0.42;
      this.sees = this.ignoreT <= 0 && dist < range && inFov && world.lineOfSight(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z);
    }
    if (this.sees) {
      this.awareness += dt * (dist < 3 ? 6 : 0.7 + 2.6 * (1 - dist / range));
      this.lastKnown = { x: pl.pos.x, z: pl.pos.z };
      this.lostT = 0;
    } else {
      this.awareness = Math.max(0, this.awareness - dt * 0.2);
      this.lostT += dt;
    }
    return dist;
  }

  _follow(dt, speed) {
    if (!this.path || this.pi >= this.path.length) return true;
    const tgt = this.path[this.pi];
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { this.pi++; return this.pi >= this.path.length; }
    this._moveDir(dt, dx / d, dz / d, Math.min(speed * dt, d), speed);
    return false;
  }

  _moveDir(dt, nx, nz, step, speed) {
    this.pos.x += nx * step; this.pos.z += nz * step;
    const want = Math.atan2(nx, nz);
    this.heading += angleDiff(this.heading, want) * Math.min(1, dt * 7);
    this.speedNow = speed;
    // Türen auf dem Weg öffnen
    const world = this.g.world;
    for (const ahead of [0, 0.9]) {
      const cx = world.cell(this.pos.x + nx * ahead), cz = world.cell(this.pos.z + nz * ahead);
      const door = world.inBounds(cx, cz) ? world.doorAt[world.idx(cx, cz)] : null;
      if (door && !door.open) {
        const fast = this.state === 'chase' || this.state === 'repel';
        world.setDoor(door, true, this.pos.x, this.pos.z, fast);
        if (fast) this.g.audio.doorSlam({ x: door.x, y: 1.2, z: door.z }); else this.g.audio.doorOpen({ x: door.x, y: 1.2, z: door.z });
      }
    }
  }

  _pickWander() {
    const pl = this.g.player.pos, w = this.g.world;
    const nearPlayer = Math.random() < (this.g.finalPhase ? 0.6 : 0.3);
    const p = w.randomWalkable((q) => {
      const dp = Math.hypot(q.x - pl.x, q.z - pl.z), ds = Math.hypot(q.x - this.pos.x, q.z - this.pos.z);
      return nearPlayer ? dp < 14 && dp > 4 : ds > 8;
    });
    this.goTo(p.x, p.z);
  }

  update(dt) {
    const pl = this.g.player;
    if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.z) || !Number.isFinite(this.heading)) {
      const p = this.g.world.randomWalkable((q) => Math.hypot(q.x - pl.pos.x, q.z - pl.pos.z) > 20);
      this.heading = 0; this.reset(p.x, p.z);
    }
    this.stateT += dt;
    this.ignoreT = Math.max(0, this.ignoreT - dt);
    this.speedNow = 0;
    const dist = this._perceive(dt);
    // Mit jedem Schlüssel und während einer Jagd wird er schneller.
    const bonus = (this.g.finalPhase ? 1.15 : 1) * (1 + this.g.keysCollected * 0.04) * (this.g.hunting ? 1.12 : 1);

    if (this.state !== 'repel' && this.state !== 'chase' && this.awareness >= 1) this.setState('chase');

    switch (this.state) {
      case 'wander': {
        if (this.waitT > 0) { this.waitT -= dt; this.heading += dt * 0.6; break; }
        if (!this.path) this._pickWander();
        if (this._follow(dt, SPEED.wander * bonus)) { this.path = null; this.waitT = rand(0.5, 2.5); }
        if (this.g.finalPhase) {
          this.senseT -= dt;
          if (this.senseT <= 0) { this.senseT = rand(9, 14); this.setState('investigate'); this.goTo(pl.pos.x + rand(-3, 3), pl.pos.z + rand(-3, 3)); }
        }
        break;
      }
      case 'investigate': {
        if (this.waitT > 0) { this.waitT -= dt; this.heading += dt * 1.5; if (this.waitT <= 0) this.setState('wander'); break; }
        if (!this.path || this._follow(dt, SPEED.investigate * bonus)) { this.path = null; this.waitT = 2.5; }
        break;
      }
      case 'chase': {
        this.repathT -= dt;
        const target = this.sees ? pl.pos : this.lastKnown;
        if (!target) { this.setState('search'); break; }
        const speed = SPEED.chase * bonus;
        if (this.sees && dist < 9 && this.g.world.walkableLine(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z, 0.2)) {
          const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
          this._moveDir(dt, dx / (dist || 1), dz / (dist || 1), Math.min(speed * dt, dist), speed);
          this.path = null;
        } else {
          if (this.repathT <= 0 || !this.path) { this.repathT = 0.35; this.goTo(target.x, target.z); }
          const arrived = this._follow(dt, speed);
          if (arrived && !this.sees) this.setState('search');
        }
        if (this.lostT > 4) this.setState('search');
        break;
      }
      case 'search': {
        if (!this.path) {
          if (this.searchPts >= 4 || this.stateT > 14) { this.searchPts = 0; this.awareness = 0; this.setState('wander'); break; }
          const c = this.lastKnown || this.pos;
          const p = this.g.world.randomWalkable((q) => Math.hypot(q.x - c.x, q.z - c.z) < 7);
          this.goTo(p.x, p.z); this.searchPts++;
        }
        if (this._follow(dt, SPEED.search * bonus)) this.path = null;
        break;
      }
      case 'repel': {
        this._follow(dt, SPEED.repel);
        if (this.stateT > 4.5) { this.ignoreT = 3; this.awareness = 0; this.setState('wander'); }
        break;
      }
    }

    // Festhängen erkennen
    this.stuckT += dt;
    if (this.stuckT > 2.5) {
      if (this.path && Math.hypot(this.pos.x - this.stuckRef.x, this.pos.z - this.stuckRef.z) < 0.3) this.path = null;
      this.stuckT = 0; this.stuckRef = { x: this.pos.x, z: this.pos.z };
    }

    this.model.group.position.set(this.pos.x, 0, this.pos.z);
    this.model.group.rotation.y = this.heading;
    this.model.animate(dt, this.state === 'chase' ? 1 : this.state === 'investigate' ? 0.3 : 0, this.speedNow);
    const voice = { chase: 0.9, investigate: 0.45, search: 0.5, wander: 0.3, repel: 0.15 }[this.state] || 0.3;
    this.g.audio.setGhost(this.pos, voice);
  }

  serialize() { return { x: this.pos.x, z: this.pos.z, h: this.heading }; }
}
