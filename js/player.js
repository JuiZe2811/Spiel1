import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp } from './util.js';

export const CRUCIFIX_ACTIVE = 4;
export const CRUCIFIX_COOLDOWN = 20;

export class Player {
  constructor(game, camera, tex) {
    this.g = game;
    this.camera = camera;
    this.radius = 0.3;
    this.pos = { x: 0, z: 0 };
    this.vel = { x: 0, z: 0 };

    // Taschenlampe (folgt immer der Kamera)
    this.flash = new THREE.SpotLight(0xfff1d6, 26, 24, 0.5, 0.55, 1.5);
    this.flash.target = new THREE.Object3D();
    game.scene.add(this.flash, this.flash.target);
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.camera.near = 0.2; this.flash.shadow.camera.far = 24;
    this.flash.shadow.bias = -0.002;

    // Kruzifix in der Hand
    this.cross = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xb08a3a, emissive: 0x000000 });
    this.crossMat = gold;
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.025), gold);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.025), gold);
    h.position.y = 0.045;
    this.crossGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xffe7a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.crossGlow.scale.set(0.6, 0.6, 1);
    this.cross.add(v, h, this.crossGlow);
    this.cross.position.set(0.12, -0.5, -0.5);
    this.cross.visible = false;
    camera.add(this.cross);
    this.crossLight = new THREE.PointLight(0xffe2a0, 0, 8, 2);
    camera.add(this.crossLight);
    this.reset(0, 0, 0);
  }

  reset(x, z, yaw) {
    this.pos.x = x; this.pos.z = z;
    this.vel.x = this.vel.z = 0;
    this.yaw = yaw; this.pitch = 0;
    this.eye = 1.62;
    this.stamina = 1; this.exhausted = false; this.staminaDelay = 0;
    this.crouching = false; this.sprinting = false;
    this.flashlightOn = true;
    this.bob = 0; this.stepAcc = 0;
    this.crossActive = 0; this.crossCooldown = 0;
    this.flicker = 1;
    this.moving = false;
  }

  get crossReady() { return this.crossActive <= 0 && this.crossCooldown <= 0; }

  useCrucifix() {
    if (!this.crossReady) return false;
    this.crossActive = CRUCIFIX_ACTIVE;
    return true;
  }

  look(dx, dy, sens, invertY) {
    const k = 0.0022 * sens;
    this.yaw -= dx * k;
    this.pitch -= dy * k * (invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.35, 1.35);
  }

  update(dt, input) {
    const g = this.g;
    if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.z)) { this.pos.x = g.world.start.x; this.pos.z = g.world.start.z; }
    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    if (!Number.isFinite(this.pitch)) this.pitch = 0;
    // Sprinten (Ducken gibt es seit v1.2.0 nicht mehr)
    this.crouching = input.crouch;
    const mx = input.moveX, my = input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    const wantSprint = input.sprint && !this.crouching && my > 0.2 && !this.exhausted;
    this.sprinting = wantSprint && mag > 0.3;
    if (this.sprinting) {
      this.stamina -= dt / 6; this.staminaDelay = 0.9;
      if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; input.sprintToggle = false; g.audio.breath(); }
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(1, this.stamina + dt / 4.5);
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;
    }
    const speed = this.crouching ? 1.4 : this.sprinting ? 5.0 : 2.9;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let tx = (fx * my + rx * mx), tz = (fz * my + rz * mx);
    const tl = Math.hypot(tx, tz);
    if (tl > 1) { tx /= tl; tz /= tl; }
    tx *= speed; tz *= speed;
    const a = 1 - Math.exp(-dt * 12);
    this.vel.x = lerp(this.vel.x, tx, a); this.vel.z = lerp(this.vel.z, tz, a);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (!this.hidden) g.world.collide(this.pos, this.radius);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.moving = moved > 0.2 * dt;

    // Schritte → Geräusche, auf die der Geist reagiert
    this.stepAcc += moved;
    const stride = this.sprinting ? 1.0 : this.crouching ? 0.6 : 0.78;
    if (this.stepAcc > stride) {
      this.stepAcc = 0;
      const zone = g.world.zoneAtPos(this.pos.x, this.pos.z);
      const intensity = this.sprinting ? 0.9 : this.crouching ? 0.12 : 0.45;
      g.audio.footstep(zone, intensity);
      g.makeNoise(this.pos.x, this.pos.z, this.sprinting ? 13 : this.crouching ? 1.2 : 4.5);
    }

    // Kamera
    const targetEye = this.crouching ? 1.0 : 1.62;
    this.eye = lerp(this.eye, targetEye, 1 - Math.exp(-dt * 10));
    this.bob += moved * (this.sprinting ? 2.4 : 3.2);
    const bobY = Math.sin(this.bob * 2) * 0.035 * clamp(moved / dt / 3, 0, 1.4);
    const cam = this.camera;
    cam.position.set(this.pos.x, this.eye + bobY, this.pos.z);
    cam.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.006, 'YXZ');
    cam.updateMatrixWorld();

    // Taschenlampe
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    this.flash.position.set(cam.position.x + rx * 0.12, cam.position.y - 0.12, cam.position.z + rz * 0.12);
    this.flash.target.position.copy(cam.position).addScaledVector(dir, 6);
    this.flash.target.updateMatrixWorld();
    this.flash.intensity = this.flashlightOn ? 26 * this.flicker : 0;
    this.flash.visible = true;

    // Kruzifix
    if (this.crossActive > 0) {
      this.crossActive -= dt;
      if (this.crossActive <= 0) { this.crossActive = 0; this.crossCooldown = CRUCIFIX_COOLDOWN; }
    } else if (this.crossCooldown > 0) this.crossCooldown = Math.max(0, this.crossCooldown - dt);
    const act = this.crossActive > 0;
    this.cross.visible = act || this.cross.position.y > -0.45;
    const ty = act ? -0.16 : -0.55;
    this.cross.position.y = lerp(this.cross.position.y, ty, 1 - Math.exp(-dt * 10));
    this.cross.rotation.z = act ? Math.sin(performance.now() * 0.02) * 0.02 : 0;
    const glow = act ? 0.7 + Math.sin(performance.now() * 0.012) * 0.2 : 0;
    this.crossGlow.material.opacity = glow;
    this.crossMat.emissive.setRGB(glow * 0.6, glow * 0.45, glow * 0.15);
    this.crossLight.intensity = act ? 4 * glow : 0;
    this.crossLight.position.set(0.1, -0.15, -0.5);
  }

  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }

  serialize() { return { x: this.pos.x, z: this.pos.z, yaw: this.yaw, pitch: this.pitch, light: this.flashlightOn, cc: this.crossCooldown + this.crossActive }; }
}
