import * as THREE from '../vendor/three.module.min.js';
import { clamp, rand, angleDiff } from './util.js';

// Zerfetzter Saum: Alpha-Verlauf von unten (durchsichtig, eingerissen) nach oben (fest).
function tatterAlpha() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, '#000'); g.addColorStop(0.18, '#333'); g.addColorStop(0.42, '#fff'); g.addColorStop(1, '#fff');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  // Risse von unten nach oben
  for (let i = 0; i < 26; i++) {
    const px = Math.random() * 256, w = 3 + Math.random() * 12, h = 40 + Math.random() * 120;
    const gr = x.createLinearGradient(0, 256, 0, 256 - h);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.beginPath(); x.moveTo(px - w, 256); x.lineTo(px + w, 256); x.lineTo(px + (Math.random() - 0.5) * 6, 256 - h); x.fill();
  }
  // Mottenlöcher
  x.fillStyle = '#000';
  for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(Math.random() * 256, 90 + Math.random() * 166, 1 + Math.random() * 4, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Stoff mit Flecken und Falten
function clothMap() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c9cfd2'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,45,50,${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, 0, 2 + Math.random() * 8, 256); }
  for (let i = 0; i < 14; i++) {
    const px = Math.random() * 256, py = Math.random() * 200, r = 8 + Math.random() * 30;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(60,40,30,0.35)'); g.addColorStop(1, 'rgba(60,40,30,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hairAlpha() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 26; i++) {
    const px = 6 + Math.random() * 52, len = 140 + Math.random() * 116, w = 1 + Math.random() * 2.5;
    const g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, '#fff'); g.addColorStop(0.75, '#ddd'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.strokeStyle = g; x.lineWidth = w;
    x.beginPath(); x.moveTo(px, 0);
    x.bezierCurveTo(px + (Math.random() - 0.5) * 10, len * 0.3, px + (Math.random() - 0.5) * 14, len * 0.7, px + (Math.random() - 0.5) * 12, len);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function crackedSkin() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#cfcac0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, r = 10 + Math.random() * 40;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(30,28,25,0.35)'); g.addColorStop(1, 'rgba(30,28,25,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  x.strokeStyle = 'rgba(20,18,16,0.55)';
  for (let i = 0; i < 40; i++) {
    let px = Math.random() * 256, py = Math.random() * 256; x.lineWidth = 0.6 + Math.random();
    x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 5; j++) { px += (Math.random() - 0.5) * 26; py += (Math.random() - 0.5) * 26; x.lineTo(px, py); }
    x.stroke();
  }
  const img = x.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 30; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let GEO = null;
function geometries() {
  if (GEO) return GEO;
  // Gebeugte, ausgemergelte Silhouette
  const profile = [[0.5, 0], [0.44, 0.25], [0.35, 0.62], [0.27, 1.0], [0.22, 1.2], [0.205, 1.36], [0.19, 1.43]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const robe = new THREE.LatheGeometry(profile, 20);
  const head = new THREE.SphereGeometry(0.15, 18, 14);
  const face = new THREE.SphereGeometry(0.153, 22, 16, Math.PI / 2 - 0.95, 1.9, 0.5, 1.95);
  const hair = new THREE.SphereGeometry(0.162, 16, 10, -Math.PI / 2 - (Math.PI + 0.5) / 2, Math.PI + 0.5, 0, 2.2);
  const strand = new THREE.PlaneGeometry(0.11, 1); strand.translate(0, -0.5, 0);
  const rag = new THREE.PlaneGeometry(0.16, 0.8); rag.translate(0, -0.4, 0);
  const upper = new THREE.CapsuleGeometry(0.032, 0.42, 3, 6); upper.translate(0, -0.25, 0);
  const fore = new THREE.CapsuleGeometry(0.026, 0.4, 3, 6); fore.translate(0, -0.23, 0);
  const palm = new THREE.BoxGeometry(0.06, 0.08, 0.02); palm.translate(0, -0.04, 0);
  const finger = new THREE.CapsuleGeometry(0.0075, 0.07, 2, 4); finger.translate(0, -0.045, 0);
  const neck = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8); neck.translate(0, 0.11, 0);
  const torso = new THREE.CapsuleGeometry(0.14, 0.18, 4, 12); torso.scale(1.0, 1, 0.62);
  const ring = new THREE.TorusGeometry(0.032, 0.009, 8, 18);
  const lens = new THREE.CircleGeometry(0.026, 18);
  // Isolator: gerippte Spule aus Bakelit
  const ins = [];
  const addCyl = (r1, r2, h, y) => { const c = new THREE.CylinderGeometry(r1, r2, h, 12); c.translate(0, y, 0); ins.push(c); };
  addCyl(0.034, 0.038, 0.02, 0.01); addCyl(0.024, 0.024, 0.03, 0.035); addCyl(0.033, 0.033, 0.012, 0.056);
  addCyl(0.022, 0.022, 0.025, 0.074); addCyl(0.03, 0.03, 0.012, 0.092); addCyl(0.018, 0.012, 0.03, 0.112);
  GEO = { robe, head, face, hair, strand, rag, upper, fore, palm, finger, neck, torso, ring, lens, ins };
  return GEO;
}

export function createGhostMaterials(faceTex, glowTex) {
  const alpha = tatterAlpha();
  return {
    robe: new THREE.MeshLambertMaterial({ map: clothMap(), color: 0x3d3d3d, emissive: 0x090909, alphaMap: alpha, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }),
    rag: new THREE.MeshLambertMaterial({ color: 0x343434, emissive: 0x070707, alphaMap: alpha, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }),
    wire: new THREE.MeshLambertMaterial({ color: 0x0c0c0c }),
    bakelite: new THREE.MeshPhongMaterial({ color: 0x101010, specular: 0x2a2a2a, shininess: 40 }),
    metal: new THREE.MeshPhongMaterial({ color: 0x6c6c6c, specular: 0xbbbbbb, shininess: 90 }),
    socket: new THREE.MeshBasicMaterial({ color: 0x020202 }),
    strand: new THREE.MeshLambertMaterial({ color: 0x050505, alphaMap: hairAlpha(), alphaTest: 0.35, side: THREE.DoubleSide }),
    skin: new THREE.MeshLambertMaterial({ map: crackedSkin(), color: 0x9f9b93, emissive: 0x121110 }),
    hair: new THREE.MeshLambertMaterial({ color: 0x040404, side: THREE.DoubleSide }),
    face: new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, color: 0xb4b0a8 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    glow: glowTex || null,
  };
}

// 3D-Modell des Geistes mit Stoff-, Haar-, Finger- und Kopfanimationen.
export class GhostModel {
  constructor(mats, shadow = false) {
    const G = geometries();
    const m = (k) => (shadow ? mats.shadow : mats[k]);
    this.group = new THREE.Group();
    this.inner = new THREE.Group();     // für Zucken/Flackern, ohne die KI-Position zu stören
    this.group.add(this.inner);
    this.body = new THREE.Group();
    this.inner.add(this.body);

    // Gewand mit eigener Geometrie (wird pro Bild verformt)
    this.robeGeo = G.robe.clone();
    this.robeBase = this.robeGeo.attributes.position.array.slice();
    this.robe = new THREE.Mesh(this.robeGeo, m('robe'));
    this.body.add(this.robe);

    // Stofffetzen, die vom Gewand herabhängen
    this.rags = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rand(-0.2, 0.2), y = rand(0.35, 0.9);
      const r = 0.48 - y * 0.18;
      const rag = new THREE.Mesh(G.rag, m('rag'));
      rag.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      rag.rotation.y = a; rag.scale.set(rand(0.7, 1.3), rand(0.8, 1.4), 1);
      this.body.add(rag); this.rags.push({ mesh: rag, phase: rand(0, 6) });
    }

    // Hals und Kopf (ragt bei der Jagd nach vorn)
    this.neck = new THREE.Mesh(G.neck, m('skin')); this.neck.position.set(0, 1.56, 0.02);
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.78, 0.04);
    this.head.scale.set(1.25, 1.4, 1.25);
    this.head.add(new THREE.Mesh(G.head, m('skin')));
    if (!shadow) { this.faceMesh = new THREE.Mesh(G.face, mats.face); this.head.add(this.faceMesh); }
    this.strands = [];
    // Dürrer, blasser Oberkörper mit Trägern des zerrissenen Hemds
    const torso = new THREE.Mesh(G.torso, m('skin')); torso.position.set(0, 1.47, 0.0); this.body.add(torso);
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.012), m('robe'));
      strap.position.set(sx * 0.1, 1.5, 0.115); strap.rotation.x = -0.25; this.body.add(strap);
      const back = strap.clone(); back.position.z = -0.115; back.rotation.x = 0.25; this.body.add(back);
    }
    // Augen: links ein Metallring mit Linse, rechts eine hohle Höhle mit Ring
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(G.ring, m('metal')); ring.position.set(sx * 0.052, 0.025, 0.148); this.head.add(ring);
      if (sx < 0) {
        const inner = new THREE.Mesh(G.ring, m('metal')); inner.scale.setScalar(0.55); inner.position.set(sx * 0.052, 0.025, 0.152); this.head.add(inner);
        const lens = new THREE.Mesh(G.lens, m('bakelite')); lens.position.set(sx * 0.052, 0.025, 0.146); this.head.add(lens);
      } else {
        const hole = new THREE.Mesh(G.lens, m('socket')); hole.position.set(sx * 0.052, 0.025, 0.145); this.head.add(hole);
      }
    }
    // Isolatoren seitlich am Kopf (wie Elektroden)
    this.sparkPoints = [];
    for (const [x, y, z, rz, ry] of [[-0.12, 0.09, 0.0, 1.0, 0.2], [-0.14, -0.02, 0.03, 1.45, 0.1], [0.12, 0.09, 0.0, -1.0, -0.2], [0.14, -0.02, 0.03, -1.45, -0.1]]) {
      const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.set(0, ry, rz);
      for (const g of G.ins) grp.add(new THREE.Mesh(g, m('bakelite')));
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6), m('metal')); tip.position.y = 0.14; grp.add(tip);
      this.head.add(grp);
      const sp = new THREE.Object3D(); sp.position.y = 0.17; grp.add(sp); this.sparkPoints.push(sp);
    }
    // Wirre Drähte um Kopf und Hals
    const wm = m('wire');
    for (let w = 0; w < 9; w++) {
      const pts = [];
      const start = this.sparkPoints[w % 4].parent.position.clone();
      pts.push(start);
      const n = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.14 + Math.random() * 0.11;
        const down = w > 5 && i > n - 3;
        pts.push(new THREE.Vector3(Math.cos(a) * r, down ? -0.22 - Math.random() * 0.2 : (Math.random() - 0.4) * 0.32, Math.sin(a) * r * 0.85));
      }
      if (w < 4) pts.push(new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.28 + Math.random() * 0.12, (Math.random() - 0.5) * 0.15)); // abstehend
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0032, 4, false), wm);
      this.head.add(tube);
    }
    // Glimmende Augenpunkte (vor allem bei der Jagd)
    this.eyes = [];
    if (!shadow && mats.glow) {
      for (const sx of [-1, 1]) {
        const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: mats.glow, color: 0xd8f4ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
        e.position.set(sx * 0.052, 0.025, 0.156); e.scale.set(0.05, 0.05, 1);
        this.head.add(e); this.eyes.push(e);
      }
    }
    this.body.add(this.head);

    // Lange, knochige Arme mit Ellbogen, Hand und Fingern
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.2, 1.48, 0.02);
      shoulder.add(new THREE.Mesh(G.upper, m('skin')));
      const elbow = new THREE.Group(); elbow.position.y = -0.5; shoulder.add(elbow);
      elbow.add(new THREE.Mesh(G.fore, m('skin')));
      const wrist = new THREE.Group(); wrist.position.y = -0.46; elbow.add(wrist);
      wrist.add(new THREE.Mesh(G.palm, m('skin')));
      const fingers = [];
      for (let f = 0; f < 4; f++) {
        const base = new THREE.Group(); base.position.set((f - 1.5) * 0.016, -0.08, 0); base.rotation.z = (f - 1.5) * -0.06;
        const seg1 = new THREE.Mesh(G.finger, m('skin')); base.add(seg1);
        const knuckle = new THREE.Group(); knuckle.position.y = -0.09; base.add(knuckle);
        const seg2 = new THREE.Mesh(G.finger, m('skin')); knuckle.add(seg2);
        base.scale.y = f === 0 || f === 3 ? 1.0 : 1.25; // überlange Mittelfinger
        wrist.add(base); fingers.push({ base, knuckle });
      }
      this.body.add(shoulder);
      return { side, shoulder, elbow, wrist, fingers };
    });

    // Nebelschleier, der vom Saum aufsteigt
    this.mist = [];
    if (!shadow && mats.glow) {
      for (let i = 0; i < 10; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mats.glow, color: 0x7d8c99, transparent: true, opacity: 0, depthWrite: false }));
        this.inner.add(sp); this.mist.push({ sp, life: rand(0, 1.6), max: rand(1.2, 2) });
      }
    }

    this.sparks = [];
    if (!shadow && mats.glow) {
      for (const p of this.sparkPoints) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mats.glow, color: 0xd6ecff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        p.add(sp); this.sparks.push({ sp, t: 0 });
      }
    }
    this.sparkT = rand(1, 3); this.sparked = false;
    this.t = Math.random() * 10;
    this.twitchT = 0; this.headTarget = { x: 0, y: 0, z: 0.25 };
    this.glitchT = 0; this.nextGlitch = rand(1, 3);
    this.mode = 'wander';
  }

  // reach: 0..1 (Arme greifen), speed: m/s, mode: KI-Zustand ('chase', 'wander', 'kill', …)
  animate(dt, reach = 0, speed = 0, mode = 'wander') {
    this.t += dt;
    const t = this.t, chase = mode === 'chase' || mode === 'kill', kill = mode === 'kill';

    // Schweben und Vorbeugen
    this.body.position.y = 0.14 + Math.sin(t * 1.8) * 0.06;
    const lean = kill ? 0 : clamp(speed * 0.06, 0, 0.32) + (chase ? 0.12 : 0);
    this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 4);
    this.body.rotation.z = Math.sin(t * 1.1) * 0.035;

    // Gewand weht: Saum flattert, zieht beim Laufen nach hinten
    const pos = this.robeGeo.attributes.position, a = pos.array, b = this.robeBase;
    const drag = Math.min(speed, 6) * 0.05;
    for (let i = 0; i < a.length; i += 3) {
      const x = b[i], y = b[i + 1], z = b[i + 2];
      const low = Math.max(0, 1 - y / 1.1), k = low * low;
      const ang = Math.atan2(x, z);
      const w = Math.sin(t * 3.2 + ang * 3 + y * 5) * 0.07 * k + Math.sin(t * 5.1 + ang * 7) * 0.025 * k;
      const r = 1 + w / (Math.hypot(x, z) + 0.001);
      a[i] = x * r; a[i + 1] = y + Math.sin(t * 2.4 + ang * 4) * 0.04 * k; a[i + 2] = z * r - drag * k;
    }
    pos.needsUpdate = true;

    for (const r of this.rags) {
      r.mesh.rotation.x = Math.sin(t * 3 + r.phase) * 0.25 + drag * 2.2;
      r.mesh.rotation.z = Math.sin(t * 2.3 + r.phase * 2) * 0.18;
    }
    for (const s of this.strands) {
      s.mesh.rotation.x = (s.front ? -0.06 : 0.04) + Math.sin(t * 1.7 + s.phase) * 0.06 + (s.front ? 0 : drag * 0.8);
      s.mesh.rotation.z = Math.sin(t * 1.3 + s.phase) * 0.05;
    }

    // Ruckartige Kopfbewegungen (wie ein gebrochener Hals)
    this.twitchT -= dt;
    if (this.twitchT <= 0) {
      this.twitchT = chase ? rand(0.25, 0.9) : rand(1.2, 3.5);
      this.headTarget = chase
        ? { x: rand(0.15, 0.45), y: rand(-0.35, 0.35), z: rand(-0.7, 0.7) }
        : { x: rand(-0.1, 0.3), y: rand(-0.7, 0.7), z: rand(-0.2, 0.5) + 0.2 };
    }
    const snap = Math.min(1, dt * (chase ? 28 : 10));
    const hd = this.head.rotation;
    hd.x += (this.headTarget.x - hd.x) * snap;
    hd.y += (this.headTarget.y - hd.y) * snap;
    hd.z += (this.headTarget.z - hd.z) * snap;
    const jut = kill ? 0.02 : chase ? 0.14 : 0.03;
    this.head.position.z += (jut - this.head.position.z) * Math.min(1, dt * 5);
    this.head.position.y = 1.78 + (chase ? -0.04 : 0);
    this.neck.rotation.x = this.head.position.z * 2.2;
    if (kill) { hd.x += (Math.random() - 0.5) * 0.4; hd.z += (Math.random() - 0.5) * 0.5; }

    // Arme: hängend und zuckend – bei der Jagd nach vorne greifend, Finger krallen
    for (const arm of this.arms) {
      const s = arm.side, ph = s > 0 ? 0 : Math.PI;
      const tx = -0.12 - reach * 1.35 + Math.sin(t * 1.4 + ph) * 0.06 + (chase ? Math.sin(t * 9 + ph) * 0.12 : 0);
      arm.shoulder.rotation.x += (tx - arm.shoulder.rotation.x) * Math.min(1, dt * 7);
      arm.shoulder.rotation.z = s * (0.1 + reach * 0.05) + Math.sin(t * 0.9 + ph) * 0.03;
      const bend = reach > 0.5 ? -0.25 : -0.12 - Math.sin(t * 1.1 + ph) * 0.08;
      arm.elbow.rotation.x += (bend - arm.elbow.rotation.x) * Math.min(1, dt * 6);
      arm.wrist.rotation.x = reach > 0.5 ? -0.3 : 0.15;
      arm.fingers.forEach((f, i) => {
        const curl = chase ? 0.55 + Math.sin(t * 11 + i * 0.7 + ph) * 0.5 : 0.25 + Math.sin(t * 2 + i) * 0.12 + (Math.random() < 0.01 ? 0.6 : 0);
        f.base.rotation.x = curl * 0.8; f.knuckle.rotation.x = curl * 1.1;
      });
    }

    // Augen glimmen stärker, wenn er jagt
    for (const e of this.eyes) {
      const target = chase ? 0.95 : 0.18;
      e.material.opacity += (target - e.material.opacity) * Math.min(1, dt * 4);
      e.scale.setScalar(chase ? 0.06 + Math.random() * 0.01 : 0.045);
    }

    // Nebelschleier
    for (const m of this.mist) {
      m.life += dt;
      if (m.life > m.max) {
        m.life = 0; m.max = rand(1.2, 2.2);
        const a = rand(0, Math.PI * 2);
        m.sp.position.set(Math.sin(a) * 0.35, rand(0.05, 0.4), Math.cos(a) * 0.35 - 0.1);
        m.vx = rand(-0.1, 0.1); m.vz = -0.15 - drag; m.vy = rand(0.15, 0.35);
      }
      const k = m.life / m.max;
      m.sp.position.x += (m.vx || 0) * dt; m.sp.position.y += (m.vy || 0.2) * dt; m.sp.position.z += (m.vz || -0.1) * dt;
      m.sp.scale.setScalar(0.35 + k * 0.6);
      m.sp.material.opacity = Math.sin(k * Math.PI) * (chase ? 0.22 : 0.14);
    }

    // Elektrische Funken an den Isolatoren
    this.sparkT -= dt;
    if (this.sparkT <= 0 && this.sparks.length) {
      this.sparkT = chase ? rand(0.3, 1.2) : rand(2, 6);
      const s = this.sparks[Math.floor(Math.random() * this.sparks.length)];
      s.t = rand(0.08, 0.2); this.sparked = true;
    }
    for (const s of this.sparks) {
      if (s.t > 0) { s.t -= dt; s.sp.material.opacity = Math.random() < 0.7 ? 1 : 0.2; s.sp.scale.setScalar(rand(0.08, 0.18)); }
      else s.sp.material.opacity = 0;
    }

    // Flackern/Zucken: Er „springt“ kurz, als würde das Bild aussetzen
    this.nextGlitch -= dt;
    if (this.nextGlitch <= 0) { this.glitchT = rand(0.04, chase ? 0.14 : 0.08); this.nextGlitch = chase ? rand(0.6, 1.8) : rand(3, 8); }
    if (this.glitchT > 0) {
      this.glitchT -= dt;
      this.inner.visible = Math.random() < 0.35;
      this.inner.position.set((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25);
    } else { this.inner.visible = true; this.inner.position.set(0, 0, 0); }
    if (kill) { this.inner.visible = true; this.inner.position.set((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0); }
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
    if (pl.sprinting) range *= 1.15;
    if (this.g.finalPhase) range *= 1.25;
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 0.12;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      const inFov = dist < 2.4 || (dx * fx + dz * fz) / (dist || 1) > 0.42;
      this.sees = !this.g.playerHidden && this.ignoreT <= 0 && dist < range && inFov && world.lineOfSight(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z);
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
    this.model.animate(dt, this.state === 'chase' ? 1 : this.state === 'investigate' ? 0.3 : 0, this.speedNow, this.state);
    if (this.model.sparked) { this.model.sparked = false; this.g.audio.zap({ x: this.pos.x, y: 1.9, z: this.pos.z }); }
    const voice = { chase: 0.9, investigate: 0.45, search: 0.5, wander: 0.3, repel: 0.15 }[this.state] || 0.3;
    this.g.audio.setGhost(this.pos, voice);
  }

  serialize() { return { x: this.pos.x, z: this.pos.z, h: this.heading }; }
}
