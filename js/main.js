import * as THREE from '../vendor/three.module.min.js';
import { settings, saveSettings, detectQuality, QUALITY } from './settings.js';
import { createTextures, grainDataURL } from './textures.js';
import { World } from './world.js';
import { FaceManager, FaceEditor } from './face.js';
import { GhostModel, Ghost, createGhostMaterials } from './ghost.js';
import { Player } from './player.js';
import { ScareDirector } from './scares.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Flares, MAX_FLARES } from './flares.js';
import { AmbientDirector } from './ambient.js';
import { VERSION } from './version.js';
import { $, $$, store, rand, clamp, shuffle, angleDiff } from './util.js';

const SAVE_KEY = 'f5s_save_v1';
const TOTAL_KEYS = 5;
const COMPASS_TIME = 3;
const COMPASS_COOLDOWN = 30;
const STILL = { moveX: 0, moveY: 0, sprint: false, crouch: false };

class Game {
  constructor() {
    this.settings = settings;
    this.state = 'boot';
    this.input = new Input({
      canvas: $('#game'), joyZone: $('#joy-zone'), lookZone: $('#look-zone'),
      joyBase: $('#joy-base'), joyKnob: $('#joy-knob'), buttons: $$('#touch [data-act]'),
    });
    this.ui = new UI(this);
    this.audio = new AudioEngine();
    this.audio.setVolume(settings.volume);
    this.audio.scareScale = settings.reduceScares ? 0.55 : 1;

    this.qualityName = settings.quality === 'auto' ? detectQuality(this.input.mode === 'touch') : settings.quality;
    const q = QUALITY[this.qualityName];
    this.renderer = new THREE.WebGLRenderer({
      canvas: $('#game'), antialias: this.qualityName === 'high', powerPreference: 'high-performance', stencil: false,
    });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030304);
    this.scene.fog = new THREE.FogExp2(0x040506, q.fogDensity);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, q.far);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0x2a3040, 0.85));
    this.scene.add(new THREE.HemisphereLight(0x222a3a, 0x0a0806, 0.5));

    this.tex = createTextures();
    this.world = new World(this.scene, this.tex, { lights: 4 });
    this.face = new FaceManager();
    const gm = createGhostMaterials(this.face.texture);
    this.ghostModel = new GhostModel(gm);
    this.scene.add(this.ghostModel.group);
    this.player = new Player(this, this.camera, this.tex);
    this.ghost = new Ghost(this, this.ghostModel);
    this.scares = new ScareDirector(this, new GhostModel(gm), new GhostModel(gm, true));
    this._buildKeys();
    this.flares = new Flares(this);
    this.ambient = new AmbientDirector(this, new GhostModel(gm, true));
    this._buildCompass();
    this.hintT = 0; this.hintCd = 0; this.chimeT = 0;

    this.scale = q.startScale;
    this.shakeAmt = 0;
    this.flickerOverride = null;
    this.flickT = 0; this.flickV = 1;
    this.perf = { frames: 0, time: 0, good: 0 };
    this.saveT = 0;
    this.grace = 0;
    this.finalPhase = false;

    this.applyQuality(true);
    this._bindUI();
    this._bindSystem();
    this.face.onChange(() => this._faceChanged());
    this._faceChanged();
    $('#fx-grain').style.backgroundImage = `url(${grainDataURL()})`;

    this.resize();
    this.toMenu();
    $('#loading').hidden = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.loop(t));
  }

  // ---------- Qualität & Größe ----------
  applyQuality(initial = false) {
    const q = this.q = QUALITY[this.qualityName];
    this.scale = clamp(this.scale, q.minScale, q.maxScale);
    if (!initial) this.scale = q.startScale;
    this.renderer.shadowMap.enabled = q.shadows;
    this.player.flash.castShadow = q.shadows;
    this.scene.fog.density = q.fogDensity;
    this.camera.far = q.far;
    this.camera.updateProjectionMatrix();
    this.world.lights.forEach((L, i) => { L.light.visible = i < q.lights; L.bulb.visible = i < q.lights; });
    this.world.setShadows(q.shadows);
    $('#fx-grain').hidden = !q.grain;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);
    this.renderer.setPixelRatio(dpr * this.scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.2 ? 80 : 72;
    this.camera.updateProjectionMatrix();
    this._checkOrientation();
  }

  _adapt(dt) {
    const p = this.perf;
    p.frames++; p.time += dt;
    if (p.time < 2) return;
    const fps = p.frames / p.time;
    p.frames = 0; p.time = 0;
    if (settings.showFps) this.ui.fps(`${fps.toFixed(0)} FPS · ${this.qualityName} · ${(this.scale * 100).toFixed(0)}%`);
    const target = this.input.mode === 'touch' ? 30 : 50;
    const q = this.q;
    if (fps < target * 0.9 && this.scale > q.minScale + 0.001) {
      this.scale = Math.max(q.minScale, this.scale - 0.1); p.good = 0; this.resize();
    } else if (fps < target * 0.7 && settings.quality === 'auto' && this.qualityName !== 'low') {
      this.qualityName = this.qualityName === 'high' ? 'medium' : 'low'; this.applyQuality();
    } else if (fps > target * 1.6 || fps > 57) {
      if (++p.good >= 3 && this.scale < q.maxScale) { this.scale = Math.min(q.maxScale, this.scale + 0.05); p.good = 0; this.resize(); }
    } else p.good = 0;
  }

  _checkOrientation() {
    const portrait = this.input.mode === 'touch' && window.innerHeight > window.innerWidth;
    $('#rotate').hidden = !portrait;
    if (portrait && this.state === 'playing') this.pause(true);
  }

  // ---------- Schlüssel ----------
  _buildKeys() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xe0b85a, emissive: 0x6a4410 });
    const ring = new THREE.TorusGeometry(0.06, 0.016, 6, 14);
    const shaft = new THREE.BoxGeometry(0.17, 0.022, 0.022);
    const tooth = new THREE.BoxGeometry(0.025, 0.05, 0.02);
    this.keys = [];
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const g = new THREE.Group();
      const inner = new THREE.Group();
      const r = new THREE.Mesh(ring, mat); r.position.x = -0.1;
      const s = new THREE.Mesh(shaft, mat); s.position.x = 0.03;
      const t1 = new THREE.Mesh(tooth, mat); t1.position.set(0.09, -0.03, 0);
      const t2 = new THREE.Mesh(tooth, mat); t2.position.set(0.05, -0.03, 0);
      inner.add(r, s, t1, t2);
      inner.scale.setScalar(1.5);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffcf6a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.0, 1.0, 1);
      g.add(inner, glow);
      g.visible = false;
      this.scene.add(g);
      this.keys.push({ group: g, inner, glow, x: 0, y: 0, z: 0, collected: false });
    }
  }

  _placeKeys(saved) {
    if (saved) {
      saved.forEach((k, i) => Object.assign(this.keys[i], { x: k.x, y: k.y, z: k.z, collected: k.c }));
    } else {
      const spots = this.world.keySpots();
      const regions = shuffle([...spots.keys()]).slice(0, TOTAL_KEYS);
      regions.forEach((rid, i) => {
        const list = spots.get(rid);
        // Gewichtete Wahl: Tische und Ecken bevorzugt
        const total = list.reduce((s, c) => s + c.w, 0);
        let r = Math.random() * total, pick = list[0];
        for (const c of list) { r -= c.w; if (r <= 0) { pick = c; break; } }
        Object.assign(this.keys[i], { x: pick.x + rand(-0.15, 0.15), y: pick.y, z: pick.z + rand(-0.15, 0.15), collected: false });
      });
    }
    for (const k of this.keys) {
      k.group.position.set(k.x, k.y + 0.15, k.z);
      k.group.visible = !k.collected;
    }
  }

  get keysCollected() { return this.keys.filter((k) => k.collected).length; }

  // ---------- Spielablauf ----------
  toMenu() {
    this.state = 'menu';
    this.input.active = false;
    this.input.exitLock();
    this.ui.setPlayMode(false, this.input.mode);
    this.ui.show('screen-menu', false);
    $('#btn-continue').hidden = !store.get(SAVE_KEY, null);
    this.audio.silenceGame();
    this.scares.hideAll();
    this.ui.threat(0);
    this._endHunt(true);
    // Kulisse für das Menü
    this.world.resetDynamic();
    this.keys.forEach((k) => { k.group.visible = false; });
    this.flares.pickups.forEach((p) => { p.group.visible = false; });
    this.flares.clearActive();
    this._leaveHide(true);
    this.ambient.reset();
    this.compass.visible = false; this.hintT = 0;
    this.player.reset(this.world.start.x, this.world.start.z + 1, 0);
    this.ghostModel.group.visible = true;
    this.ghostModel.group.position.set(this.world.start.x + 0.6, 0, this.world.start.z - 13);
    this.ghostModel.group.rotation.y = 0;
    this.menuT = 0;
  }

  newGame() {
    store.del(SAVE_KEY);
    this._startCommon();
    this._placeKeys(null);
    this.flares.place(null);
    this.player.reset(this.world.start.x, this.world.start.z, 0);
    const s = this.world.start;
    const far = this.world.randomWalkable((p) => Math.hypot(p.x - s.x, p.z - s.z) > 28);
    this.ghost.reset(far.x, far.z);
    this.elapsed = 0;
    this.finalPhase = false;
    this.hunting = false;
    this.huntNext = rand(45, 70);
    this.grace = 3;
    this.ui.message('Finde die fünf Schlüssel. Er hört dich.', 4.5);
    this._play();
  }

  continueGame() {
    const s = store.get(SAVE_KEY, null);
    if (!s || !s.keys) return this.newGame();
    this._startCommon();
    this._placeKeys(s.keys);
    this.flares.place(s.flares || null);
    s.doors.forEach((open, i) => {
      const d = this.world.doors[i];
      if (d && open) { this.world.setDoor(d, true, d.x - 1, d.z - 1); d.angle = d.target; d.pivot.rotation.y = d.angle; }
    });
    this.player.reset(s.player.x, s.player.z, s.player.yaw);
    this.player.pitch = s.player.pitch || 0;
    this.player.flashlightOn = s.player.light !== false;
    this.player.crossCooldown = s.player.cc || 0;
    let gx = s.ghost.x, gz = s.ghost.z;
    if (Math.hypot(gx - s.player.x, gz - s.player.z) < 15) {
      const far = this.world.randomWalkable((p) => Math.hypot(p.x - s.player.x, p.z - s.player.z) > 20);
      gx = far.x; gz = far.z;
    }
    this.ghost.reset(gx, gz);
    this.elapsed = s.elapsed || 0;
    this.finalPhase = !!s.finalPhase;
    if (this.finalPhase) this._unlockExit(true);
    this.grace = 3;
    this.ui.message('Spielstand geladen.', 2.5);
    this._play();
  }

  _startCommon() {
    this.world.resetDynamic();
    this.scares.reset();
    this.ghostModel.group.visible = true;
    this.input.sprintToggle = false;
    this._leaveHide(true);
    this.ambient.reset();
    this.hintT = 0; this.hintCd = 0; this.compassUp = 0; this.compass.visible = false;
    this.ui.fade(false);
    this.ui.objective('Finde die fünf Schlüssel');
    this._endHunt(true);
    this.huntNext = rand(45, 70);
    $('#scare-face').classList.remove('show');
  }

  _play() {
    this.audio.unlock();
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setPlayMode(true, this.input.mode);
    this.ui.setKeys(this.keysCollected, TOTAL_KEYS);
    this.input.releaseAll();
    this.input.actions = [];
    this.input.active = true;
    this.input.requestLock();
    if (this.input.mode === 'touch' && settings.autoFullscreen) this.enterFullscreen();
    this.last = performance.now();
    this.save();
  }

  pause(auto = false) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.active = false;
    this.input.releaseAll();
    this.input.actions = [];
    this.pausedAt = performance.now();
    this.input.exitLock();
    this.save();
    this.audio.suspend();
    this.ui.setPlayMode(false, this.input.mode);
    $('#pause-note').hidden = !auto;
    this._syncSettingsUI();
    this.ui.show('screen-pause', false);
  }

  resume() {
    if (this.state !== 'paused') return;
    if (this.input.mode === 'touch' && window.innerHeight > window.innerWidth) { this._checkOrientation(); return; }
    this.audio.unlock();
    this.grace = Math.max(this.grace, 1.5);
    this.state = 'playing';
    this.ui.hideScreens();
    this.ui.setPlayMode(true, this.input.mode);
    this.input.active = true;
    this.input.requestLock();
    this.last = performance.now();
  }

  save() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    store.set(SAVE_KEY, {
      v: 1,
      keys: this.keys.map((k) => ({ x: k.x, y: k.y, z: k.z, c: k.collected })),
      doors: this.world.doors.map((d) => d.open),
      player: this.hidden ? { ...this.player.serialize(), x: this.hidden.front.x, z: this.hidden.front.z, light: this.hideLight } : this.player.serialize(),
      ghost: this.ghost.serialize(),
      elapsed: this.elapsed,
      finalPhase: this.finalPhase,
      flares: this.flares.serialize(),
    });
  }

  makeNoise(x, z, radius) { if (this.state === 'playing') this.ghost.hearNoise(x, z, radius); }

  onGhostSpotted() {
    if (this.state !== 'playing') return;
    const red = settings.reduceScares;
    this.audio.yell(red ? 0.45 : 1);
    this.audio.ghostShriek(this.ghost.pos);
    this.ui.flash(red ? 0.15 : 0.4);
    this.shake(red ? 0.15 : 0.45);
    this.ui.message('Er hat dich gesehen. LAUF!', 2.5);
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ---------- Interaktion ----------
  _findInteractable() {
    const p = this.player.pos, f = this.player.forward();
    if (this.hidden) return { type: 'unhide', desk: `${this.hidden.name} verlassen`, touch: 'RAUSGEHEN' };
    let best = null, bd = 1e9;
    const consider = (d, obj) => { if (d < bd) { bd = d; best = obj; } };
    for (const h of this.world.hides) {
      const d = Math.hypot(h.front.x - p.x, h.front.z - p.z);
      if (d > 1.4) continue;
      const dx = h.x - p.x, dz = h.z - p.z, l = Math.hypot(dx, dz) || 1;
      if ((dx * f.x + dz * f.z) / l < 0.1 && d > 0.6) continue;
      consider(d - 0.2, { type: 'hide', h, desk: `Im ${h.name} verstecken`, touch: 'VERSTECKEN' });
    }
    for (const door of this.world.doors) {
      const dx = door.x - p.x, dz = door.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1.9) continue;
      const facing = (dx * f.x + dz * f.z) / (d || 1);
      if (d > 1.0 && facing < 0.25) continue;
      consider(d, { type: 'door', door, desk: door.open ? 'Tür schließen' : 'Tür öffnen', touch: door.open ? 'TÜR ZU' : 'TÜR ÖFFNEN' });
    }
    const e = this.world.exit;
    const de = Math.hypot(e.x - p.x, e.z - p.z);
    if (de < 2.2) consider(de, e.unlocked
      ? { type: 'exit', desk: 'Fliehen!', touch: 'FLIEHEN' }
      : { type: 'exitLocked', desk: `Ausgang verschlossen (${this.keysCollected}/${TOTAL_KEYS})`, touch: `VERSCHLOSSEN ${this.keysCollected}/${TOTAL_KEYS}` });
    return best;
  }

  _interact(it) {
    if (!it) return;
    if (it.type === 'key') {
      it.k.collected = true;
      it.k.group.visible = false;
      this.audio.keyPickup();
      this.makeNoise(this.player.pos.x, this.player.pos.z, 6);
      const n = this.keysCollected;
      this.ui.setKeys(n, TOTAL_KEYS);
      if (n >= TOTAL_KEYS) this._unlockExit(false);
      else this.ui.message(`Schlüssel gefunden — ${n}/${TOTAL_KEYS}`, 2.5);
      // Jeder Fund hat Folgen: ein Schock kurz danach, beim 2. und 4. Schlüssel beginnt eine Jagd.
      this.scares.soon(rand(1.5, 3));
      if (n === 2 || n === 4) this.huntNext = Math.min(this.huntNext, 5);
      this.save();
    } else if (it.type === 'flare') {
      if (this.flares.take(it.pk)) {
        this.audio.click(); this.audio.keyChime(null);
        const how = this.input.mode === 'touch' ? 'mit der Bengalo-Taste' : 'mit G';
        this.ui.message(`Roter Bengalo eingesammelt (${this.flares.count}/${MAX_FLARES}). Werfen ${how}.`, 3);
        this.save();
      }
    } else if (it.type === 'hide') {
      this._enterHide(it.h);
    } else if (it.type === 'unhide') {
      this._leaveHide(false);
    } else if (it.type === 'door') {
      const d = it.door, p = this.player.pos;
      if (d.open && Math.hypot(d.x - p.x, d.z - p.z) < 0.75) { this.ui.message('Du stehst in der Tür.', 1.5); return; }
      this.world.setDoor(d, !d.open, p.x, p.z);
      if (d.open) this.audio.doorOpen({ x: d.x, y: 1.2, z: d.z }); else this.audio.doorClose({ x: d.x, y: 1.2, z: d.z });
      this.makeNoise(d.x, d.z, 6);
    } else if (it.type === 'exitLocked') {
      this.audio.knock({ x: this.world.exit.x, y: 1.2, z: this.world.exit.z });
      this.ui.message(`Die Tür ist verriegelt. Dir fehlen noch ${TOTAL_KEYS - this.keysCollected} Schlüssel.`, 2.5);
    } else if (it.type === 'exit') {
      this._win();
    }
  }

  _unlockExit(silent) {
    this.finalPhase = true;
    const e = this.world.exit;
    e.unlocked = true;
    e.lamp.material.color.set(0x22ff66);
    this.ui.objective('Fliehe durch den Ausgang in der Eingangshalle');
    if (!silent) {
      this.audio.unlockExit();
      this.ui.message('Alle fünf Schlüssel! Der Ausgang ist offen — LAUF!', 4);
      this.ghost.setState('investigate');
      this.ghost.goTo(this.player.pos.x, this.player.pos.z);
    }
  }

  _useCrucifix() {
    if (!this.player.useCrucifix()) {
      this.ui.message(this.player.crossActive > 0 ? 'Das Kruzifix schützt dich bereits.' : `Kruzifix lädt noch (${Math.ceil(this.player.crossCooldown)} s)`, 1.5);
      return;
    }
    this.audio.crucifix();
    this.ui.flash(0.25);
  }

  // ---------- Automatisch aufsammeln ----------
  _autoPickup() {
    const p = this.player.pos;
    for (const k of this.keys) {
      if (!k.collected && Math.hypot(k.x - p.x, k.z - p.z) < 1.15) this._interact({ type: 'key', k });
    }
    for (const pk of this.flares.pickups) {
      if (pk.taken) continue;
      const d = Math.hypot(pk.x - p.x, pk.z - p.z);
      if (d < 0.95) {
        if (this.flares.count < MAX_FLARES) this._interact({ type: 'flare', pk });
        else if (!pk.warned) { pk.warned = true; this.ui.message(`Du kannst nur ${MAX_FLARES} Bengalos tragen. Wirf erst einen.`, 2); }
      } else if (d > 2) pk.warned = false;
    }
  }

  // ---------- Verstecke ----------
  get playerHidden() { return !!this.hidden && !this.hideCompromised; }

  _enterHide(h) {
    const pl = this.player, g = this.ghost;
    const gd = Math.hypot(g.pos.x - pl.pos.x, g.pos.z - pl.pos.z);
    // Hat er gesehen, wie du hineingeschlüpft bist? Dann ist das Versteck verraten.
    this.hideCompromised = g.state !== 'repel' && g.sees && gd < 7;
    this.hidden = h;
    this.hideT = 0; this.hideNearMsg = false;
    this.hideLight = pl.flashlightOn;
    pl.flashlightOn = false;
    pl.hidden = true;
    pl.pos.x = h.x; pl.pos.z = h.z;
    pl.yaw = h.yaw; pl.pitch = 0;
    pl.vel.x = pl.vel.z = 0;
    this.input.sprintToggle = false;
    document.body.dataset.hide = h.type;
    const pos = { x: h.x, y: 1.2, z: h.z };
    if (h.type === 'locker') this.audio.metalClank(pos); else if (h.type === 'wardrobe') this.audio.doorOpen(pos); else this.audio.scrape(pos);
    if (this.hideCompromised) this.ui.message('Er hat gesehen, wo du dich versteckst!', 2.5);
    else {
      this.ui.message(`Versteckt im ${h.name}. Bleib ganz ruhig …`, 2.5);
      // Er verliert deine Spur und sucht dort, wo er dich zuletzt gesehen hat.
      if (g.chasing) { g.lastKnown = { x: h.front.x + (Math.random() - 0.5) * 3, z: h.front.z + (Math.random() - 0.5) * 3 }; g.awareness = 0.4; }
    }
  }

  _leaveHide(silent) {
    const h = this.hidden;
    if (!h) return;
    const pl = this.player;
    this.hidden = null; this.hideCompromised = false;
    pl.hidden = false;
    pl.pos.x = h.front.x; pl.pos.z = h.front.z;
    this.world.collide(pl.pos, pl.radius);
    pl.flashlightOn = this.hideLight !== false;
    delete document.body.dataset.hide;
    if (!silent) { if (h.type === 'locker') this.audio.metalClank({ x: h.x, y: 1.2, z: h.z }); else this.audio.doorClose({ x: h.x, y: 1.2, z: h.z }); }
  }

  _updateHidden(dt, gd) {
    const h = this.hidden, pl = this.player, g = this.ghost;
    this.hideT += dt;
    // Nur durch die Schlitze nach vorn schauen
    pl.yaw = h.yaw + clamp(angleDiff(h.yaw, pl.yaw), -0.85, 0.85);
    pl.pitch = clamp(pl.pitch, -0.45, 0.35);
    if (this.hideCompromised && g.state !== 'repel') {
      if (!g.chasing) g.setState('chase');
      g.lastKnown = { x: h.front.x, z: h.front.z }; g.lostT = 0;
      if (Math.hypot(g.pos.x - h.front.x, g.pos.z - h.front.z) < 1.1 && this.grace <= 0) {
        if (pl.crossActive > 0) { g.repel(); this.hideCompromised = false; } else { this.audio.doorSlam({ x: h.x, y: 1.2, z: h.z }); this._die(); return true; }
      }
    } else if (gd < 6 && !this.hideNearMsg) { this.hideNearMsg = true; this.ui.message('Er ist ganz nah … nicht bewegen.', 2.5); }
    else if (gd > 9) this.hideNearMsg = false;
    return false;
  }

  _die() {
    this.state = 'dying';
    this._leaveHide(true);
    this.dieT = 0;
    this.input.active = false;
    this.input.releaseAll();
    this.input.exitLock();
    store.del(SAVE_KEY);
    this.scares.hideAll();
    this.ui.setPlayMode(false, this.input.mode);
    this.ui.threat(0);
    this._endHunt(true);
    const red = settings.reduceScares;
    this.audio.scream(red ? 0.5 : 1);
    this.ui.showScareFace(red ? 0.6 : 1.15);
    this.shake(red ? 0.2 : 0.6);
  }

  _win() {
    this.state = 'won';
    this.winT = 0;
    this.input.active = false;
    this.input.releaseAll();
    this.input.exitLock();
    store.del(SAVE_KEY);
    this.scares.hideAll();
    this.world.exit.opening = 0.01;
    this.world.exit.outside.visible = true;
    this.audio.silenceGame();
    this.ui.threat(0);
    this._endHunt(true);
    this.audio.win();
    this.ui.setPlayMode(false, this.input.mode);
    setTimeout(() => this.ui.fade(true, '#e9ecef'), 500);
  }

  // ---------- Hauptschleife ----------
  loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);

    if (this.state === 'playing') {
      const steps = Math.ceil(dt / 0.034) || 1;
      for (let i = 0; i < steps && this.state === 'playing'; i++) this.update(dt / steps);
      this._adapt(dt);
    } else if (this.state === 'paused') {
      if (this.input.consumeActions().includes('pause') && performance.now() - this.pausedAt > 400 && this.ui.current === 'screen-pause') this.resume();
      return; // nichts rendern: spart Akku, letzter Frame bleibt stehen
    } else if (this.state === 'dying') this._updateDying(dt);
    else if (this.state === 'won') this._updateWin(dt);
    else if (this.state === 'menu') this._updateMenu(dt);
    else return;

    this.ui.update(dt);
    if (this.shakeAmt > 0) {
      this.camera.rotation.x += (Math.random() - 0.5) * this.shakeAmt * 0.12;
      this.camera.rotation.y += (Math.random() - 0.5) * this.shakeAmt * 0.12;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    }
    this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    const pl = this.player, input = this.input;
    this.elapsed += dt;
    this.grace = Math.max(0, this.grace - dt);

    const [dx, dy] = input.consumeLook();
    pl.look(dx, dy, input.mode === 'touch' ? settings.sensTouch : settings.sensMouse, settings.invertY);

    const it = this._findInteractable();
    for (const a of input.consumeActions()) {
      if (a === 'pause') { this.pause(false); return; }
      if (a === 'light') {
        if (this.hidden) this.ui.message('Im Versteck bleibt das Licht aus.', 1.5);
        else { pl.flashlightOn = !pl.flashlightOn; this.audio.click(); }
      }
      if (a === 'cross') this._useCrucifix();
      if (a === 'interact') this._interact(it);
      if (a === 'flare' && this.hidden) this.ui.message('Aus dem Versteck kannst du nicht werfen.', 1.5);
      else if (a === 'flare') {
        if (this.flares.throw() === 'none') this.ui.message('Du hast keinen Bengalo. Sie liegen rot leuchtend im Gebäude.', 2.2);
        else this.makeNoise(pl.pos.x, pl.pos.z, 5);
      }
      if (a === 'hint') this._useHint();
    }

    // Taschenlampe flackert, wenn der echte Geist nahe ist
    const g = this.ghost;
    const gd = Math.hypot(g.pos.x - pl.pos.x, g.pos.z - pl.pos.z);
    this.flickT -= dt;
    if (this.flickT <= 0) {
      this.flickT = rand(0.04, 0.14);
      const near = clamp(1 - gd / 11, 0, 1);
      this.flickV = Math.random() < near * 0.55 ? rand(0, 0.35) : 1;
    }
    pl.flicker = this.flickerOverride ?? this.flickV;

    pl.update(dt, this.hidden ? STILL : input);
    if (this.hidden) { if (this._updateHidden(dt, gd)) return; } else this._autoPickup();
    g.update(dt);
    this.world.update(dt, g.pos);
    this.scares.update(dt);
    this.ambient.update(dt);
    this.flares.update(dt);
    this._updateHunt(dt);
    this._updateHint(dt);

    // Kruzifix schützt aktiv
    if (pl.crossActive > 0 && g.state !== 'repel' && gd < 8 && (gd < 3.5 || this.world.lineOfSight(g.pos.x, g.pos.z, pl.pos.x, pl.pos.z))) {
      g.repel();
      this.ui.message('Das Kruzifix drängt ihn zurück!', 2);
    }
    // Erwischt? (Im sicheren Versteck findet er dich nicht.)
    if (gd < 0.85 && g.state !== 'repel' && this.grace <= 0 && !this.hidden) {
      if (pl.crossActive > 0) g.repel(); else { this._die(); return; }
    }

    // Schlüssel animieren
    const t = performance.now() / 1000;
    for (const k of this.keys) if (!k.collected) {
      k.inner.rotation.y = t * 1.6;
      k.group.position.y = k.y + 0.15 + Math.sin(t * 2.2 + k.x) * 0.04;
      k.glow.material.opacity = 0.35 + Math.sin(t * 3 + k.z) * 0.15;
    }

    // Bedrohung → Musik, Herzschlag, Vignette
    let threat = 0;
    if (g.state === 'chase') threat = 1;
    else if (g.state !== 'repel') threat = clamp(1 - gd / 14, 0, 1) * (g.state === 'wander' ? 0.45 : 0.75);
    if (this.hunting) threat = Math.max(threat, 0.6);
    if (this.hidden && gd < 8) threat = Math.max(threat, 1 - gd / 10);
    this.audio.setThreat(threat);
    this.audio.update(dt, this.world.zoneAtPos(pl.pos.x, pl.pos.z) === 'k');
    const f = pl.forward();
    this.audio.updateListener(this.camera, f.x, f.z);

    // HUD
    this.ui.threat(threat * 0.85);
    this.ui.prompt(it);
    this.ui.stamina(pl.stamina, pl.exhausted);
    this.ui.crossState(pl.crossActive > 0, pl.crossCooldown);
    this.ui.toggles(pl.flashlightOn, input.sprintToggle);
    this.ui.inventory(this.flares.count, this.hintCd, this.hintT > 0);
    this.ui.lockHint(input.mode === 'desktop' && !input.pointerLocked);

    this.saveT += dt;
    if (this.saveT > 5) { this.saveT = 0; this.save(); }
  }

  // ---------- Schlüssel-Hilfe ----------
  _hintTarget() {
    const p = this.player.pos;
    let best = null, bd = 1e9;
    for (const k of this.keys) if (!k.collected) { const d = Math.hypot(k.x - p.x, k.z - p.z); if (d < bd) { bd = d; best = k; } }
    if (!best) { const e = this.world.exit; return { x: e.x, z: e.z, y: 0, exit: true, d: Math.hypot(e.x - p.x, e.z - p.z) }; }
    return { x: best.x, z: best.z, y: best.y, d: bd };
  }

  _useHint() {
    if (this.hintT > 0) return;
    if (this.hintCd > 0) { this.ui.message(`Der Kompass ist noch nicht bereit (${Math.ceil(this.hintCd)} s).`, 1.8); return; }
    this.hintT = COMPASS_TIME; this.hintCd = COMPASS_COOLDOWN;
    this.audio.click();
  }

  // Kompass in der Hand: Holz-/Messinggehäuse, Nadel zeigt zum nächsten Schlüssel (bzw. zum Ausgang).
  _buildCompass() {
    const g = new THREE.Group();
    const brass = new THREE.MeshLambertMaterial({ color: 0xb08a3a, emissive: 0x2a1c05 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.078, 0.022, 28), brass);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.006, 6, 28), brass);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.012;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#d9cba3'; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
    const grd = x.createRadialGradient(128, 128, 40, 128, 128, 128); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(60,40,10,0.45)');
    x.fillStyle = grd; x.fill();
    x.strokeStyle = '#3a2a14';
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2, l = i % 9 === 0 ? 18 : 8;
      x.lineWidth = i % 9 === 0 ? 3 : 1.2;
      x.beginPath(); x.moveTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); x.lineTo(128 + Math.sin(a) * (118 - l), 128 - Math.cos(a) * (118 - l)); x.stroke();
    }
    x.fillStyle = '#3a2a14'; x.font = '28px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    // Statt Himmelsrichtungen: verblasste Symbole
    ['✝', '☽', '✝', '☽'].forEach((t, i) => { const a = i * Math.PI / 2; x.fillText(t, 128 + Math.sin(a) * 76, 128 - Math.cos(a) * 76); });
    x.strokeStyle = 'rgba(90,10,10,0.5)'; x.lineWidth = 2; x.beginPath(); x.arc(128, 128, 40, 0, Math.PI * 2); x.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.066, 32), new THREE.MeshBasicMaterial({ map: tex, color: 0xb9ae94 }));
    face.rotation.x = -Math.PI / 2; face.position.y = 0.0115;
    const needle = new THREE.Group(); needle.position.y = 0.015;
    const shape = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((q) => sh.lineTo(q[0], q[1])); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); return geo; };
    needle.add(new THREE.Mesh(shape([[0, 0.058], [0.009, 0], [-0.009, 0]]), new THREE.MeshBasicMaterial({ color: 0xb01a12, side: THREE.DoubleSide })));
    needle.add(new THREE.Mesh(shape([[0, -0.045], [0.009, 0], [-0.009, 0]]), new THREE.MeshBasicMaterial({ color: 0xe8e2d0, side: THREE.DoubleSide })));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), brass); cap.position.y = 0.017;
    g.add(body, ring, face, needle, cap);
    g.rotation.x = 1.05;
    g.position.set(-0.02, -0.6, -0.36);
    g.visible = false;
    this.camera.add(g);
    this.compass = g; this.needle = needle;
    this.needleA = 0; this.needleV = 0; this.compassUp = 0;
  }

  _updateHint(dt) {
    const pl = this.player;
    const t = this._hintTarget();
    const active = this.hintT > 0;
    if (active) this.hintT -= dt; else this.hintCd = Math.max(0, this.hintCd - dt);
    // Kompass heben/senken
    this.compassUp += ((active ? 1 : 0) - this.compassUp) * Math.min(1, dt * 9);
    this.compass.visible = this.compassUp > 0.02;
    if (this.compass.visible) {
      this.compass.position.y = -0.6 + this.compassUp * 0.45;
      this.compass.rotation.z = Math.sin(performance.now() * 0.002) * 0.03;
      // Nadel mit Feder-Dämpfung (pendelt sich ein)
      const targetYaw = Math.atan2(-(t.x - pl.pos.x), -(t.z - pl.pos.z));
      const want = this.needleA + angleDiff(this.needleA, angleDiff(pl.yaw, targetYaw));
      this.needleV += ((want - this.needleA) * 60 - this.needleV * 7) * dt;
      this.needleA += this.needleV * dt + (Math.random() - 0.5) * 0.01;
      this.needle.rotation.y = this.needleA;
    }
    // Ein Schlüssel ganz in der Nähe klingelt leise
    this.chimeT -= dt;
    if (!t.exit && t.d < 5 && this.chimeT <= 0) { this.chimeT = 2.2; this.audio.keyChime({ x: t.x, y: t.y + 0.3, z: t.z }); }
  }

  // ---------- Jagdphasen: rote Lichter, er sucht gezielt in deiner Nähe ----------
  _updateHunt(dt) {
    const g = this.ghost, pl = this.player.pos;
    if (!this.hunting) {
      this.huntNext -= dt;
      if (this.huntNext > 0 || g.chasing || g.state === 'repel' || this.grace > 0) return;
      this.hunting = true;
      this.huntT = 14 + this.keysCollected * 1.5;
      this.huntPing = 1.5;
      this.world.huntFlicker = true;
      document.body.classList.add('hunt');
      this.audio.huntSiren();
      this.shake(0.2);
      this.ui.message('Die Lichter werden rot. ER JAGT DICH — versteck dich!', 3.5);
      return;
    }
    this.huntT -= dt;
    this.huntPing -= dt;
    if (this.huntPing <= 0) {
      this.huntPing = 4;
      // Er kennt nur deine ungefähre Position: Licht aus, leise gehen und Türen schließen helfen.
      if (!g.chasing && g.state !== 'repel') { g.setState('investigate'); g.goTo(pl.x + rand(-4, 4), pl.z + rand(-4, 4)); }
    }
    if (this.huntT <= 0) {
      this._endHunt(false);
      this.ui.message('Die Jagd ist vorbei … vorerst.', 2.5);
    }
  }

  _endHunt(silent) {
    this.hunting = false;
    this.world.huntFlicker = false;
    document.body.classList.remove('hunt');
    if (!silent) this.huntNext = Math.max(30, rand(60, 95) - this.keysCollected * 7);
  }

  _updateDying(dt) {
    this.dieT += dt;
    const cam = this.camera, g = this.ghostModel.group;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    f.y = 0; f.normalize();
    g.position.set(cam.position.x + f.x * 0.55, cam.position.y - 1.72, cam.position.z + f.z * 0.55);
    g.rotation.y = Math.atan2(-f.x, -f.z);
    this.ghostModel.animate(dt, 1, 0);
    this.player.flicker = Math.random() < 0.5 ? 0.1 : 1;
    this.player.flash.intensity = 26 * this.player.flicker;
    if (this.dieT > 2.1 && this.state === 'dying') {
      this.state = 'over';
      this.ui.hideScareFace();
      this.audio.silenceGame();
      $('#over-stats').textContent = `Schlüssel: ${this.keysCollected}/${TOTAL_KEYS} · Zeit: ${fmtTime(this.elapsed)}`;
      this.ui.show('screen-over', false);
      this.renderer.render(this.scene, this.camera);
    }
  }

  _updateWin(dt) {
    this.winT += dt;
    this.world.update(dt, null);
    if (this.winT > 2.2 && this.state === 'won') {
      this.state = 'over';
      $('#win-stats').textContent = `Entkommen nach ${fmtTime(this.elapsed)}`;
      this.ui.show('screen-win', false);
      this.ui.fade(false);
    }
  }

  _updateMenu(dt) {
    this.menuT += dt;
    const pl = this.player;
    pl.yaw = Math.sin(this.menuT * 0.15) * 0.35;
    pl.pitch = 0.02 + Math.sin(this.menuT * 0.23) * 0.04;
    pl.flicker = Math.random() < 0.03 ? 0.1 : 1;
    pl.update(dt, { moveX: 0, moveY: 0, sprint: false, crouch: false });
    this.ghostModel.animate(dt, 0, 0);
    this.world.update(dt, null);
  }

  // ---------- Gesicht ----------
  _faceChanged() {
    const url = this.face.dataURL;
    $('#scare-img').src = url;
    $$('.face-thumb').forEach((img) => { img.src = url; });
    $('#face-status').textContent = this.face.isCustom ? 'Eigenes Gesicht aktiv' : 'Standardgesicht aktiv';
  }

  // ---------- Vollbild ----------
  get canFullscreen() {
    const el = document.documentElement;
    return !!((el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  }
  enterFullscreen() {
    if (!this.canFullscreen || document.fullscreenElement || document.webkitFullscreenElement) return;
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* egal */ } }).catch(() => {});
    } catch { /* nicht unterstützt */ }
  }
  toggleFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else this.enterFullscreen();
  }

  // ---------- UI-Verknüpfungen ----------
  _bindUI() {
    const on = (sel, fn) => $(sel).addEventListener('click', (e) => { e.preventDefault(); this.audio.unlock(); fn(); });
    on('#btn-start', () => this.newGame());
    on('#btn-continue', () => this.continueGame());
    on('#btn-face', () => { this.ui.show('screen-face'); this.editor.draw(); });
    on('#btn-settings', () => { this._syncSettingsUI(); this.ui.show('screen-settings'); });
    on('#btn-controls', () => this.ui.show('screen-controls'));
    on('#btn-fullscreen', () => this.toggleFullscreen());
    on('#btn-resume', () => this.resume());
    on('#btn-p-settings', () => { this._syncSettingsUI(); this.ui.show('screen-settings'); });
    on('#btn-p-controls', () => this.ui.show('screen-controls'));
    on('#btn-p-menu', () => this.toMenu());
    on('#btn-retry', () => this.newGame());
    on('#btn-over-menu', () => this.toMenu());
    on('#btn-win-retry', () => this.newGame());
    on('#btn-win-menu', () => this.toMenu());
    $$('.btn-back').forEach((b) => b.addEventListener('click', () => this.ui.back()));
    $('#hud-pause').addEventListener('click', (e) => { e.preventDefault(); this.pause(false); });
    $('#btn-fullscreen').hidden = !this.canFullscreen;
    if (/iPhone|iPod/.test(navigator.userAgent) && !navigator.standalone) $('#ios-hint').hidden = false;

    // Gesicht hochladen
    this.editor = new FaceEditor($('#face-canvas'), $('#face-zoom'));
    $('#face-file').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const st = $('#face-msg');
      if (!file) return;
      if (file.type && !/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(file.type)) { st.textContent = 'Bitte ein JPG-, PNG- oder WEBP-Bild wählen.'; return; }
      st.textContent = 'Bild wird geladen …';
      try {
        await this.editor.load(file);
        st.textContent = 'Schiebe das Gesicht in das Oval. Zoomen mit dem Regler oder zwei Fingern.';
        $('#btn-face-apply').disabled = false;
      } catch {
        st.textContent = 'Dieses Bild kann der Browser nicht lesen. Versuche ein JPG oder PNG.';
      }
      e.target.value = '';
    });
    on('#btn-face-apply', () => {
      const crop = this.editor.crop();
      if (!crop) return;
      const stored = this.face.setFromCrop(crop);
      $('#face-msg').textContent = stored ? 'Gesicht übernommen. Es bleibt nur auf diesem Gerät gespeichert.' : 'Gesicht übernommen (nur für diese Sitzung, Speicher voll oder gesperrt).';
    });
    on('#btn-face-default', () => { this.face.useDefault(); $('#face-msg').textContent = 'Standardgesicht wiederhergestellt.'; });

    // Einstellungen
    $$('#set-quality button').forEach((b) => b.addEventListener('click', () => {
      settings.quality = b.dataset.q; saveSettings();
      this.qualityName = settings.quality === 'auto' ? detectQuality(this.input.mode === 'touch') : settings.quality;
      this.applyQuality();
      this._syncSettingsUI();
    }));
    const bindRange = (id, key, apply) => $(id).addEventListener('input', (e) => { settings[key] = parseFloat(e.target.value); saveSettings(); apply && apply(); this._syncSettingsUI(); });
    bindRange('#set-volume', 'volume', () => this.audio.setVolume(settings.volume));
    bindRange('#set-sens-touch', 'sensTouch');
    bindRange('#set-sens-mouse', 'sensMouse');
    $('#pause-sens').addEventListener('input', (e) => {
      settings[this.input.mode === 'touch' ? 'sensTouch' : 'sensMouse'] = parseFloat(e.target.value); saveSettings(); this._syncSettingsUI();
    });
    on('#btn-patch', () => this.ui.show('screen-patch'));
    $$('.version').forEach((el) => { el.textContent = `v${VERSION}`; });
    const bindCheck = (id, key, apply) => $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; saveSettings(); apply && apply(); });
    bindCheck('#set-reduce', 'reduceScares', () => { this.audio.scareScale = settings.reduceScares ? 0.55 : 1; });
    bindCheck('#set-invert', 'invertY');
    bindCheck('#set-fps', 'showFps', () => { $('#hud-fps').hidden = !settings.showFps; });
    bindCheck('#set-fs', 'autoFullscreen');
    $('#hud-fps').hidden = !settings.showFps;
  }

  _syncSettingsUI() {
    $$('#set-quality button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === settings.quality)));
    $('#set-quality-note').textContent = settings.quality === 'auto' ? `Automatisch: aktuell ${({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch' })[this.qualityName]}` : '';
    $('#set-volume').value = settings.volume; $('#set-volume-v').textContent = `${Math.round(settings.volume * 100)} %`;
    $('#set-sens-touch').value = settings.sensTouch; $('#set-sens-touch-v').textContent = `${settings.sensTouch.toFixed(1)}×`;
    $('#set-sens-mouse').value = settings.sensMouse; $('#set-sens-mouse-v').textContent = `${settings.sensMouse.toFixed(1)}×`;
    const ps = this.input.mode === 'touch' ? settings.sensTouch : settings.sensMouse;
    $('#pause-sens').value = ps; $('#pause-sens-v').textContent = `${ps.toFixed(1)}×`;
    $('#pause-sens-label').textContent = this.input.mode === 'touch' ? 'Drehempfindlichkeit (Touch)' : 'Drehempfindlichkeit (Maus)';
    $('#set-reduce').checked = settings.reduceScares;
    $('#set-invert').checked = settings.invertY;
    $('#set-fps').checked = settings.showFps;
    $('#set-fs').checked = settings.autoFullscreen;
  }

  _bindSystem() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause(true); else this.save();
        this.audio.suspend();
      } else if (this.state === 'menu' || this.state === 'over') this.audio.resume();
    });
    window.addEventListener('pagehide', () => { if (this.state === 'playing') this.pause(true); this.save(); });
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(true); });
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'playing' && this.input.mode === 'desktop') this.pause(false); };
    this.input.onModeChange = (mode) => {
      if (this.state === 'playing') this.ui.setPlayMode(true, mode);
      else document.body.classList.toggle('touch-mode', mode === 'touch');
      this._checkOrientation();
    };
    // iOS: Audio nach Unterbrechung bei der nächsten Berührung wieder aufnehmen
    document.addEventListener('touchend', () => { if (this.state !== 'paused' && this.audio.ready) this.audio.resume(); }, { passive: true });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (this.state === 'playing') e.preventDefault(); });
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (this.state === 'playing') this.pause(true); });
  }
}

function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')} min`;
}

function boot() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) throw new Error('no webgl');
  } catch {
    $('#loading').hidden = true;
    $('#no-webgl').hidden = false;
    return;
  }
  try {
    window.game = new Game();
  } catch (err) {
    console.error(err);
    $('#loading').hidden = true;
    $('#no-webgl').hidden = false;
    $('#no-webgl-msg').textContent = `Fehler beim Start: ${err.message}`;
  }
}

boot();
