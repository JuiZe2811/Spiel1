// Rote Bengalos: im Gebäude verteilt, einsammeln, einmal werfen, brennen rot und leuchten die Umgebung aus.
import * as THREE from '../vendor/three.module.min.js';
import { rand, shuffle } from './util.js';

export const MAX_FLARES = 3;
const PICKUP_COUNT = 7;
const BURN_TIME = 30;
const GRAVITY = 9.8;

export class Flares {
  constructor(game) {
    this.g = game;
    this.count = 0;
    const stickGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.28, 8);
    stickGeo.rotateZ(Math.PI / 2);
    const capGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.05, 8);
    capGeo.rotateZ(Math.PI / 2); capGeo.translate(0.16, 0, 0);
    this.stickMat = new THREE.MeshLambertMaterial({ color: 0xc81e1e, emissive: 0x3a0505 });
    this.capMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const glowMat = (opacity) => new THREE.SpriteMaterial({ map: game.tex.glow, color: 0xff3a24, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    const makeStick = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(stickGeo, this.stickMat), new THREE.Mesh(capGeo, this.capMat));
      return g;
    };

    // Aufsammelbare Bengalos
    this.pickups = [];
    for (let i = 0; i < PICKUP_COUNT; i++) {
      const grp = new THREE.Group();
      const stick = makeStick(); stick.position.y = 0.04;
      const glow = new THREE.Sprite(glowMat(0.35)); glow.scale.set(0.55, 0.55, 1); glow.position.y = 0.08;
      grp.add(stick, glow);
      grp.visible = false;
      game.scene.add(grp);
      this.pickups.push({ group: grp, glow, x: 0, z: 0, taken: true });
    }

    // Geworfene Bengalos (Lichter vorab angelegt, damit keine Shader neu kompiliert werden müssen)
    this.active = [];
    for (let i = 0; i < 2; i++) {
      const grp = makeStick();
      const flame = new THREE.Sprite(glowMat(1)); flame.scale.set(0.5, 0.5, 1); flame.position.set(0.17, 0, 0);
      const halo = new THREE.Sprite(glowMat(0.5)); halo.scale.set(2.4, 2.4, 1);
      grp.add(flame);
      const light = new THREE.PointLight(0xff2a10, 0, 13, 1.4);
      grp.visible = false; halo.visible = false;
      game.scene.add(grp, halo, light);
      this.active.push({ group: grp, flame, halo, light, state: 'idle', pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, sound: null });
    }
  }

  // Bengalos zufällig auf begehbare Stellen verteilen (gut gestreut).
  place(saved) {
    const w = this.g.world;
    if (saved) {
      saved.pickups.forEach((p, i) => { if (this.pickups[i]) Object.assign(this.pickups[i], { x: p.x, z: p.z, taken: p.t }); });
      this.count = saved.count || 0;
    } else {
      const regs = shuffle(w.regions.filter((r) => r.cells.length > 4));
      const chosen = [];
      for (const reg of regs) {
        if (chosen.length >= PICKUP_COUNT) break;
        const cells = shuffle(reg.cells.filter(([cx, cz]) => w.isWalkable(cx, cz) && w.ch(cx, cz) !== 'D'));
        const c = cells[0];
        if (!c) continue;
        const p = { x: w.center(c[0]) + rand(-0.3, 0.3), z: w.center(c[1]) + rand(-0.3, 0.3) };
        if (Math.hypot(p.x - w.start.x, p.z - w.start.z) < 3) continue;
        chosen.push(p);
      }
      this.pickups.forEach((pk, i) => { const p = chosen[i]; if (p) Object.assign(pk, { x: p.x, z: p.z, taken: false }); else pk.taken = true; });
      this.count = 0;
    }
    for (const pk of this.pickups) {
      pk.group.position.set(pk.x, 0, pk.z);
      pk.group.rotation.y = rand(0, Math.PI * 2);
      pk.group.visible = !pk.taken;
    }
    this.clearActive();
  }

  clearActive() {
    for (const a of this.active) {
      a.state = 'idle'; a.group.visible = false; a.halo.visible = false; a.light.intensity = 0;
      if (a.sound) { a.sound.stop(); a.sound = null; }
    }
  }

  take(pk) {
    if (this.count >= MAX_FLARES) return false;
    pk.taken = true; pk.group.visible = false;
    this.count++;
    return true;
  }

  // Wirft einen Bengalo in Blickrichtung.
  throw() {
    if (this.count <= 0) return 'none';
    let slot = this.active.find((a) => a.state === 'idle');
    if (!slot) slot = this.active.reduce((a, b) => (a.t > b.t ? a : b)); // ältesten ersetzen
    if (slot.sound) { slot.sound.stop(); slot.sound = null; }
    this.count--;
    const cam = this.g.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    slot.pos.copy(cam.position).addScaledVector(dir, 0.35); slot.pos.y -= 0.15;
    slot.vel.copy(dir).multiplyScalar(9.5); slot.vel.y += 2.6;
    slot.t = 0; slot.state = 'flying';
    slot.group.visible = true; slot.halo.visible = true;
    slot.sound = this.g.audio.flareLoop(slot.pos);
    this.g.audio.flareIgnite();
    return 'ok';
  }

  update(dt) {
    const w = this.g.world, tnow = performance.now() / 1000;
    for (const pk of this.pickups) if (!pk.taken) pk.glow.material.opacity = 0.25 + Math.sin(tnow * 4 + pk.x) * 0.12;
    for (const a of this.active) {
      if (a.state === 'idle') continue;
      a.t += dt;
      if (a.state === 'flying') {
        a.vel.y -= GRAVITY * dt;
        const nx = a.pos.x + a.vel.x * dt, nz = a.pos.z + a.vel.z * dt;
        // Abprallen an Wänden, geschlossenen Türen und hohen Möbeln
        if (w.blocksSight(w.cell(nx), w.cell(a.pos.z))) a.vel.x *= -0.35; else a.pos.x = nx;
        if (w.blocksSight(w.cell(a.pos.x), w.cell(nz))) a.vel.z *= -0.35; else a.pos.z = nz;
        a.pos.y += a.vel.y * dt;
        if (a.pos.y > 2.9) { a.pos.y = 2.9; a.vel.y = -Math.abs(a.vel.y) * 0.3; }
        if (a.pos.y < 0.04) {
          a.pos.y = 0.04;
          a.vel.y = Math.abs(a.vel.y) * 0.3; a.vel.x *= 0.55; a.vel.z *= 0.55;
          if (Math.hypot(a.vel.x, a.vel.z) < 0.4 && a.vel.y < 0.6) { a.state = 'burning'; a.vel.set(0, 0, 0); this.g.audio.flareLand(a.pos); }
        }
        a.group.rotation.z += dt * 12; a.group.rotation.y += dt * 5;
      } else if (a.state === 'burning') {
        a.group.rotation.z = 0;
      }
      a.group.position.copy(a.pos);
      const fade = a.t > BURN_TIME - 3 ? Math.max(0, (BURN_TIME - a.t) / 3) : 1;
      const flick = 0.75 + Math.random() * 0.25;
      a.light.position.set(a.pos.x, a.pos.y + 0.35, a.pos.z);
      a.light.intensity = 9 * flick * fade;
      a.halo.position.set(a.pos.x, a.pos.y + 0.12, a.pos.z);
      a.halo.material.opacity = 0.45 * flick * fade;
      a.flame.material.opacity = flick * fade;
      a.flame.scale.setScalar(0.35 + Math.random() * 0.2);
      if (a.sound) a.sound.setPos(a.pos, fade);
      if (a.t >= BURN_TIME) {
        a.state = 'idle'; a.group.visible = false; a.halo.visible = false; a.light.intensity = 0;
        if (a.sound) { a.sound.stop(); a.sound = null; }
      }
    }
  }

  // Brennt in der Nähe eines Punkts ein Bengalo?
  burningNear(x, z, r) { return this.active.some((a) => a.state !== 'idle' && Math.hypot(a.pos.x - x, a.pos.z - z) < r); }

  serialize() { return { count: this.count, pickups: this.pickups.map((p) => ({ x: p.x, z: p.z, t: p.taken })) }; }
}
