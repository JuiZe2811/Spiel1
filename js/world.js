import * as THREE from '../vendor/three.module.min.js';
import { MAP } from './map.js';
import { mulberry32, clamp } from './util.js';

export const CS = 1.5;        // Zellgröße in Metern
export const WALL_H = 3.0;
export const DOOR_H = 2.2;

const WALLISH = new Set(['#', 'W', 'X']);
const FURN = new Set(['T', 'S', 'B', 'C', 'O', 'H']);
const TALL = new Set(['S', 'B', 'O', 'H']);
const FLOOR = new Set(['o', 'c', 's', 'k', 'l', 'P']);

// Sammelt Dreiecke vieler Objekte in einer einzigen Geometrie (= ein Draw Call pro Material).
class GeoBuf {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  get empty() { return this.pos.length === 0; }
  // a,b,c,d = links-unten, rechts-unten, rechts-oben, links-oben (von vorne gesehen)
  quad(a, b, c, d, n, uv) {
    const P = this.pos, N = this.nor, U = this.uv;
    for (const [v, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [a, uv[0]], [c, uv[2]], [d, uv[3]]]) {
      P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); U.push(t[0], t[1]);
    }
  }
  add(geo, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < u.length; i++) this.uv.push(u[i]);
    g.dispose();
  }
  box(cx, cy, cz, sx, sy, sz, rotY = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(1, 1, 1));
    this.add(BOX.clone().scale(sx, sy, sz), m);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);

class MinHeap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([n, f]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][1] <= a[i][1]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][1] < a[m][1]) m = l; if (r < a.length && a[r][1] < a[m][1]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[0];
  }
  get size() { return this.a.length; }
}

export class World {
  constructor(scene, tex, quality) {
    this.scene = scene;
    this.tex = tex;
    this.quality = quality;
    this.grid = MAP.map((r) => r.split(''));
    this.H = this.grid.length;
    this.W = this.grid[0].length;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.doors = [];
    this.doorAt = new Array(this.W * this.H).fill(null);
    this.colliders = Array.from({ length: this.W * this.H }, () => []);
    this.chairs = [];
    this.windows = [];
    this.lights = [];
    this.hides = [];
    this.meshes = [];
    this.start = { x: 0, z: 0 };
    this._analyze();
    this._build();
  }

  // ---------- Grundlegende Abfragen ----------
  idx(cx, cz) { return cz * this.W + cx; }
  inBounds(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.W && cz < this.H; }
  ch(cx, cz) { return this.inBounds(cx, cz) ? this.grid[cz][cx] : '#'; }
  cell(v) { return Math.floor(v / CS); }
  center(c) { return c * CS + CS / 2; }
  isWallish(cx, cz) { return WALLISH.has(this.ch(cx, cz)); }
  isOpen(cx, cz) { return !this.isWallish(cx, cz); }
  isWalkable(cx, cz) { const c = this.ch(cx, cz); return FLOOR.has(c) || c === 'D'; }
  zoneAt(cx, cz) { return this.inBounds(cx, cz) ? this.zone[this.idx(cx, cz)] : null; }
  zoneAtPos(x, z) { return this.zoneAt(this.cell(x), this.cell(z)); }
  regionAtPos(x, z) { const cx = this.cell(x), cz = this.cell(z); return this.inBounds(cx, cz) ? this.region[this.idx(cx, cz)] : -1; }
  doorClosed(d) { return Math.abs(d.angle) < 0.5; }

  blocksSight(cx, cz) {
    const c = this.ch(cx, cz);
    if (WALLISH.has(c) || TALL.has(c)) return true;
    if (c === 'D') { const d = this.doorAt[this.idx(cx, cz)]; return d && Math.abs(d.angle) < 0.8; }
    return false;
  }

  lineOfSight(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.blocksSight(this.cell(ax + dx * t), this.cell(az + dz * t))) return false;
    }
    return true;
  }

  // Wie weit ist der Weg in eine Richtung frei (für Erscheinungen)?
  freeDistance(x, z, dirX, dirZ, maxD) {
    for (let d = 0.5; d <= maxD; d += 0.4) {
      const cx = this.cell(x + dirX * d), cz = this.cell(z + dirZ * d);
      if (this.blocksSight(cx, cz) || this.ch(cx, cz) === 'T' || this.ch(cx, cz) === 'C') return d - 0.4;
    }
    return maxD;
  }

  walkableLine(ax, az, bx, bz, pad = 0.3) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < 1e-4) return true;
    const px = -dz / len * pad, pz = dx / len * pad;
    const steps = Math.ceil(len / 0.3);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = ax + dx * t, z = az + dz * t;
      if (!this.isWalkable(this.cell(x), this.cell(z))) return false;
      if (!this.isWalkable(this.cell(x + px), this.cell(z + pz))) return false;
      if (!this.isWalkable(this.cell(x - px), this.cell(z - pz))) return false;
    }
    return true;
  }

  nearestWalkable(x, z) {
    const cx = this.cell(x), cz = this.cell(z);
    if (this.isWalkable(cx, cz)) return [cx, cz];
    for (let r = 1; r < 5; r++) {
      let best = null, bd = 1e9;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (this.isWalkable(cx + i, cz + j)) {
          const d = Math.hypot(this.center(cx + i) - x, this.center(cz + j) - z);
          if (d < bd) { bd = d; best = [cx + i, cz + j]; }
        }
      }
      if (best) return best;
    }
    return [cx, cz];
  }

  // A* auf dem Zellenraster mit anschließender Pfadglättung.
  findPath(ax, az, bx, bz) {
    const [sx, sz] = this.nearestWalkable(ax, az);
    const [gx, gz] = this.nearestWalkable(bx, bz);
    const W = this.W, N = W * this.H;
    const start = sz * W + sx, goal = gz * W + gx;
    if (start === goal) return [{ x: bx, z: bz }];
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (i) => Math.hypot((i % W) - gx, ((i / W) | 0) - gz);
    const heap = new MinHeap();
    g[start] = 0; heap.push(start, h(start));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.isWalkable(nx, nz)) continue;
        if (dx && dz && (!this.isWalkable(cx + dx, cz) || !this.isWalkable(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; heap.push(ni, ng + h(ni)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => ({ x: this.center(c % W), z: this.center((c / W) | 0) }));
    if (this.isWalkable(this.cell(bx), this.cell(bz))) pts[pts.length - 1] = { x: bx, z: bz };
    // Glätten: so weit wie möglich geradeaus.
    const out = [];
    let i = 0, cx = ax, cz = az;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.walkableLine(cx, cz, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      cx = pts[j].x; cz = pts[j].z; i = j + 1;
    }
    return out;
  }

  randomWalkable(filter) {
    for (let tries = 0; tries < 300; tries++) {
      const cx = Math.floor(Math.random() * this.W), cz = Math.floor(Math.random() * this.H);
      if (!FLOOR.has(this.ch(cx, cz))) continue;
      const p = { x: this.center(cx), z: this.center(cz) };
      if (!filter || filter(p)) return p;
    }
    return { x: this.start.x, z: this.start.z };
  }

  // ---------- Kollision (Kreis gegen Achsen-Boxen) ----------
  static pushOut(p, r, minX, maxX, minZ, maxZ) {
    const qx = clamp(p.x, minX, maxX), qz = clamp(p.z, minZ, maxZ);
    let dx = p.x - qx, dz = p.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      p.x += dx / d * (r - d); p.z += dz / d * (r - d);
    } else {
      const l = p.x - minX, rr = maxX - p.x, t = p.z - minZ, b = maxZ - p.z;
      const m = Math.min(l, rr, t, b);
      if (m === l) p.x = minX - r; else if (m === rr) p.x = maxX + r; else if (m === t) p.z = minZ - r; else p.z = maxZ + r;
    }
    return true;
  }

  collide(p, r) {
    for (let iter = 0; iter < 3; iter++) {
      const x0 = this.cell(p.x - r), x1 = this.cell(p.x + r), z0 = this.cell(p.z - r), z1 = this.cell(p.z + r);
      for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (this.isWallish(cx, cz)) { World.pushOut(p, r, cx * CS, cx * CS + CS, cz * CS, cz * CS + CS); continue; }
        const i = this.idx(cx, cz);
        for (const c of this.colliders[i]) World.pushOut(p, r, c[0], c[1], c[2], c[3]);
        const d = this.doorAt[i];
        if (d && this.doorClosed(d)) { const c = d.box; World.pushOut(p, r, c[0], c[1], c[2], c[3]); }
      }
      for (const ch of this.chairs) World.pushOut(p, r, ch.x - 0.24, ch.x + 0.24, ch.z - 0.24, ch.z + 0.24);
    }
  }

  addCollider(minX, maxX, minZ, maxZ) {
    const box = [minX, maxX, minZ, maxZ];
    for (let cz = this.cell(minZ); cz <= this.cell(maxZ - 1e-4); cz++)
      for (let cx = this.cell(minX); cx <= this.cell(maxX - 1e-4); cx++)
        if (this.inBounds(cx, cz)) this.colliders[this.idx(cx, cz)].push(box);
  }

  // ---------- Türen ----------
  setDoor(d, open, fromX, fromZ, fast = false) {
    d.open = open;
    d.speed = fast ? 14 : 3.2;
    if (!open) { d.target = 0; return; }
    if (d.axis === 'z') d.target = (fromZ < d.z) ? -Math.PI / 2 : Math.PI / 2;
    else d.target = (fromX < d.x) ? Math.PI / 2 : -Math.PI / 2;
  }

  // ---------- Analyse des Grundrisses ----------
  _analyze() {
    const { W, H, grid } = this;
    // Fenster in Außenwänden
    let n = 0;
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      if (grid[cz][cx] !== '#') continue;
      if (!(cx === 0 || cz === 0 || cx === W - 1 || cz === H - 1)) continue;
      const inner = [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]].find(([x, z]) => this.inBounds(x, z) && 'olsc'.includes(grid[z][x]));
      if (inner && (n++ % 3 === 1)) grid[cz][cx] = 'W';
    }
    // Zonen
    this.zone = new Array(W * H).fill(null);
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const c = grid[cz][cx];
      if (FLOOR.has(c)) this.zone[this.idx(cx, cz)] = c === 'P' ? 'l' : c;
      if (c === 'P') { this.start = { x: this.center(cx), z: this.center(cz) }; grid[cz][cx] = 'l'; }
    }
    for (let pass = 0; pass < 3; pass++) for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const i = this.idx(cx, cz), c = grid[cz][cx];
      if (this.zone[i] || WALLISH.has(c)) continue;
      const counts = {};
      for (const [x, z] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
        const zn = this.zoneAt(x, z);
        if (zn && !(c === 'D' && grid[z][x] === 'D')) counts[zn] = (counts[zn] || 0) + (c === 'D' && zn === 'c' ? 2 : 1);
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (best) this.zone[i] = best[0];
    }
    // Räume (Regionen): Flutfüllung ohne durch Türen zu gehen
    this.region = new Int16Array(W * H).fill(-1);
    this.regions = [];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const c = grid[cz][cx];
      if (WALLISH.has(c) || c === 'D' || this.region[this.idx(cx, cz)] >= 0) continue;
      const id = this.regions.length, cells = [], q = [[cx, cz]];
      this.region[this.idx(cx, cz)] = id;
      while (q.length) {
        const [x, z] = q.pop(); cells.push([x, z]);
        for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
          const nc = this.ch(nx, nz);
          if (WALLISH.has(nc) || nc === 'D' || this.region[this.idx(nx, nz)] >= 0) continue;
          this.region[this.idx(nx, nz)] = id; q.push([nx, nz]);
        }
      }
      const zc = {}; cells.forEach(([x, z]) => { const zn = this.zoneAt(x, z); zc[zn] = (zc[zn] || 0) + 1; });
      const zone = Object.entries(zc).sort((a, b) => b[1] - a[1])[0][0];
      let sx = 0, sz = 0; cells.forEach(([x, z]) => { sx += x; sz += z; });
      this.regions.push({ id, cells, zone, cx: sx / cells.length, cz: sz / cells.length });
    }
  }

  // ---------- Geometrie ----------
  _build() {
    const T = this.tex, { W, H, grid } = this;
    const rnd = mulberry32(4242);
    const lam = (opts) => new THREE.MeshLambertMaterial(opts);
    const mats = this.mats = {
      wall: {}, floor: {}, ceiling: {},
      wood: lam({ map: T.wood }), metal: lam({ map: T.metal }), crate: lam({ map: T.crate }),
      concrete: lam({ map: T.concrete }), door: lam({ map: T.door }), frame: lam({ map: T.wood, color: 0x6a5a50 }),
      fixture: lam({ color: 0x2a2a28 }),
      lampOn: new THREE.MeshBasicMaterial({ color: 0xfff1c8 }),
      paper: lam({ map: T.paper, transparent: false }),
      puddle: new THREE.MeshPhongMaterial({ color: 0x050707, specular: 0x8899aa, shininess: 90 }),
      glass: new THREE.MeshBasicMaterial({ map: T.window, color: 0x8a96a6 }),
      exitDoor: lam({ map: T.exitDoor }),
      exitSign: new THREE.MeshBasicMaterial({ map: T.exitSign }),
      outside: new THREE.MeshBasicMaterial({ color: 0xc8d4e0, fog: false }),
    };
    for (const z of 'ocslk') {
      mats.wall[z] = lam({ map: T.wall[z] });
      mats.floor[z] = lam({ map: T.floor[z] });
    }
    mats.ceiling.def = lam({ map: T.ceiling.def });
    mats.ceiling.k = lam({ map: T.ceiling.k });

    const wallBuf = {}, floorBuf = {}, ceilBuf = { def: new GeoBuf(), k: new GeoBuf() };
    for (const z of 'ocslk') { wallBuf[z] = new GeoBuf(); floorBuf[z] = new GeoBuf(); }
    const woodBuf = new GeoBuf(), metalBuf = new GeoBuf(), crateBuf = new GeoBuf(), concreteBuf = new GeoBuf(),
      frameBuf = new GeoBuf(), fixtureBuf = new GeoBuf(), paperBuf = new GeoBuf(), puddleBuf = new GeoBuf(), glassBuf = new GeoBuf();

    const doorZone = (cx, cz) => this.zoneAt(cx, cz) || 'c';

    // Wände
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const c = grid[cz][cx];
      if (!WALLISH.has(c)) continue;
      const x0 = cx * CS, x1 = x0 + CS, z0 = cz * CS, z1 = z0 + CS;
      const faces = [
        [cx + 1, cz, [x1, z1], [x1, z0], [1, 0, 0]],
        [cx - 1, cz, [x0, z0], [x0, z1], [-1, 0, 0]],
        [cx, cz + 1, [x0, z1], [x1, z1], [0, 0, 1]],
        [cx, cz - 1, [x1, z0], [x0, z0], [0, 0, -1]],
      ];
      for (const [nx, nz, a, b, n] of faces) {
        if (!this.isOpen(nx, nz)) continue;
        const zone = doorZone(nx, nz);
        const y0 = c === 'X' ? 2.45 : 0, v0 = y0 / WALL_H;
        wallBuf[zone].quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], WALL_H, b[1]], [a[0], WALL_H, a[1]], n,
          [[0, v0], [1, v0], [1, 1], [0, 1]]);
        if (c === 'W') this._addWindow(a, b, n, frameBuf, glassBuf);
        if (c === 'X') this._buildExit(cx, cz, a, b, n);
      }
    }

    // Böden, Decken, Möbel
    const rooms = [];
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const c = grid[cz][cx];
      if (WALLISH.has(c)) continue;
      const zone = doorZone(cx, cz);
      const x0 = cx * CS, x1 = x0 + CS, z0 = cz * CS, z1 = z0 + CS;
      const uv = [[x0 / 3, z1 / 3], [x1 / 3, z1 / 3], [x1 / 3, z0 / 3], [x0 / 3, z0 / 3]];
      floorBuf[zone].quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], uv);
      ceilBuf[zone === 'k' ? 'k' : 'def'].quad([x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0],
        [[x0 / 3, z0 / 3], [x1 / 3, z0 / 3], [x1 / 3, z1 / 3], [x0 / 3, z1 / 3]]);
      const xc = x0 + CS / 2, zc = z0 + CS / 2;
      const alongX = (ch) => grid[cz][cx - 1] === ch || grid[cz][cx + 1] === ch || !(this.ch(cx, cz - 1) === ch || this.ch(cx, cz + 1) === ch);
      if (c === 'D') this._buildDoor(cx, cz, frameBuf);
      else if (c === 'T') {
        const ax = alongX('T'), lx = ax ? CS : 0.85, lz = ax ? 0.85 : CS;
        woodBuf.box(xc, 0.76, zc, lx, 0.05, lz);
        woodBuf.box(xc, 0.4, zc + (ax ? 0.3 : 0), ax ? lx - 0.1 : 0.04, 0.6, ax ? 0.04 : lz - 0.1);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) metalBuf.box(xc + sx * (lx / 2 - 0.06), 0.37, zc + sz * (lz / 2 - 0.06), 0.05, 0.74, 0.05);
        if (rnd() < 0.6) paperBuf.box(xc + (rnd() - 0.5) * 0.6, 0.79, zc + (rnd() - 0.5) * 0.3, 0.22, 0.004, 0.3, rnd() * 3);
        this.addCollider(xc - lx / 2, xc + lx / 2, zc - lz / 2, zc + lz / 2);
        // Stuhl vor dem Tisch
        const side = ax ? [0, 1] : [1, 0];
        const chx = xc + side[0] * 0.75, chz = zc + side[1] * 0.75;
        if (rnd() < 0.55 && this.ch(cx + side[0], cz + side[1]) !== 'T' && FLOOR.has(this.ch(cx + side[0], cz + side[1]))) this._addChair(chx, chz, rnd() * 6.28);
      } else if (c === 'S') {
        const ax = alongX('S'), lx = ax ? CS - 0.05 : 0.55, lz = ax ? 0.55 : CS - 0.05;
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) metalBuf.box(xc + sx * (lx / 2 - 0.03), 1.05, zc + sz * (lz / 2 - 0.03), 0.05, 2.1, 0.05);
        for (let k = 0; k < 5; k++) {
          const y = 0.15 + k * 0.48;
          metalBuf.box(xc, y, zc, lx, 0.03, lz);
          if (k < 4) for (let b = 0; b < 3; b++) if (rnd() < 0.65) {
            const s = 0.2 + rnd() * 0.18;
            crateBuf.box(xc + (ax ? (b - 1) * 0.45 : 0), y + s / 2 + 0.02, zc + (ax ? 0 : (b - 1) * 0.45), s * 1.3, s, s, (rnd() - 0.5) * 0.4);
          }
        }
        this.addCollider(xc - lx / 2, xc + lx / 2, zc - lz / 2, zc + lz / 2);
      } else if (c === 'B') {
        woodBuf.box(xc, 1.0, zc, 1.0, 2.0, 0.55);
        frameBuf.box(xc, 1.0, zc + 0.28, 0.02, 1.9, 0.01);
        this.addCollider(xc - 0.5, xc + 0.5, zc - 0.28, zc + 0.28);
      } else if (c === 'C') {
        crateBuf.box(xc, 0.45, zc, 0.9, 0.9, 0.9, (rnd() - 0.5) * 0.3);
        if (rnd() < 0.6) crateBuf.box(xc + 0.1, 1.15, zc - 0.05, 0.5, 0.5, 0.5, rnd());
        this.addCollider(xc - 0.55, xc + 0.55, zc - 0.55, zc + 0.55);
      } else if (c === 'H') {
        this._buildHide(cx, cz, zone, woodBuf, metalBuf, crateBuf, frameBuf);
      } else if (c === 'O') {
        concreteBuf.box(xc, WALL_H / 2, zc, 0.6, WALL_H, 0.6);
        this.addCollider(xc - 0.3, xc + 0.3, zc - 0.3, zc + 0.3);
      } else {
        if ((zone === 'o' || zone === 'c' || zone === 'l') && rnd() < 0.06) paperBuf.box(xc + (rnd() - 0.5), 0.004, zc + (rnd() - 0.5), 0.22, 0.004, 0.3, rnd() * 6);
        if (zone === 'k' && rnd() < 0.08) {
          const r = 0.25 + rnd() * 0.5;
          const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(xc + (rnd() - 0.5) * 0.6, 0.006, zc + (rnd() - 0.5) * 0.6);
          puddleBuf.add(new THREE.CircleGeometry(r, 10), m);
        }
      }
    }

    // Deckenleuchten: eine pro Raum
    for (const reg of this.regions) {
      const [cx, cz] = reg.cells.reduce((best, c) => (Math.hypot(c[0] - reg.cx, c[1] - reg.cz) < Math.hypot(best[0] - reg.cx, best[1] - reg.cz) ? c : best));
      rooms.push({ reg, x: this.center(cx), z: this.center(cz) });
      fixtureBuf.box(this.center(cx), WALL_H - 0.04, this.center(cz), 0.9, 0.06, 0.28);
    }

    // Rohre im Keller
    const pipe = new THREE.CylinderGeometry(1, 1, 1, 8);
    for (const reg of this.regions.filter((r) => r.zone === 'k')) {
      const xs = reg.cells.map((c) => c[0]), zs = reg.cells.map((c) => c[1]);
      const minX = Math.min(...xs) * CS, maxX = (Math.max(...xs) + 1) * CS;
      for (const [zf, rad, y] of [[0.3, 0.09, 2.72], [0.7, 0.05, 2.82]]) {
        const z = (Math.min(...zs) + (Math.max(...zs) - Math.min(...zs)) * zf) * CS + CS / 2;
        const m = new THREE.Matrix4().compose(new THREE.Vector3((minX + maxX) / 2, y, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), new THREE.Vector3(rad, maxX - minX, rad));
        metalBuf.add(pipe, m);
      }
    }

    const addMesh = (buf, mat, receive = true, cast = false) => {
      if (buf.empty) return null;
      const mesh = new THREE.Mesh(buf.build(), mat);
      mesh.receiveShadow = receive; mesh.castShadow = cast;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      this.group.add(mesh); this.meshes.push(mesh);
      return mesh;
    };
    for (const z of 'ocslk') { addMesh(wallBuf[z], mats.wall[z], true, true); addMesh(floorBuf[z], mats.floor[z]); }
    addMesh(ceilBuf.def, mats.ceiling.def); addMesh(ceilBuf.k, mats.ceiling.k);
    addMesh(woodBuf, mats.wood, true, true); addMesh(metalBuf, mats.metal, true, true); addMesh(crateBuf, mats.crate, true, true);
    addMesh(concreteBuf, mats.concrete, true, true); addMesh(frameBuf, mats.frame, true, true); addMesh(fixtureBuf, mats.fixture);
    addMesh(paperBuf, mats.paper); addMesh(puddleBuf, mats.puddle); addMesh(glassBuf, mats.glass, false);

    this._buildLights(rooms);
  }

  _addWindow(a, b, n, frameBuf, glassBuf) {
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    const ux = (b[0] - a[0]) / CS, uz = (b[1] - a[1]) / CS; // Richtung entlang der Wand
    const off = 0.025, w = 0.5, y0 = 1.0, y1 = 2.4;
    const px = cx + n[0] * off, pz = cz + n[2] * off;
    const A = [px - ux * w, y0, pz - uz * w], B = [px + ux * w, y0, pz + uz * w];
    glassBuf.quad(A, B, [B[0], y1, B[2]], [A[0], y1, A[2]], n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const rot = Math.atan2(n[0], n[2]);
    frameBuf.box(px, y0 - 0.05, pz, 1.15, 0.1, 0.08, rot);
    frameBuf.box(px, y1 + 0.05, pz, 1.15, 0.1, 0.08, rot);
    frameBuf.box(px - ux * (w + 0.04), (y0 + y1) / 2, pz - uz * (w + 0.04), 0.08, y1 - y0, 0.08, rot);
    frameBuf.box(px + ux * (w + 0.04), (y0 + y1) / 2, pz + uz * (w + 0.04), 0.08, y1 - y0, 0.08, rot);
    this.windows.push({ x: px + n[0] * 0.03, z: pz + n[2] * 0.03, nx: n[0], nz: n[2], y: (y0 + y1) / 2 + 0.1 });
  }

  // Versteck: Rückseite an der Wand, Öffnung zeigt in den Raum.
  _buildHide(cx, cz, zone, woodBuf, metalBuf, crateBuf, frameBuf) {
    const xc = this.center(cx), zc = this.center(cz);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Wand, deren gegenüberliegende Seite frei ist
    let wall = dirs.find(([dx, dz]) => this.isWallish(cx + dx, cz + dz) && this.isOpen(cx - dx, cz - dz) && !this.isWallish(cx - dx, cz - dz))
      || dirs.find(([dx, dz]) => this.isWallish(cx + dx, cz + dz)) || [0, -1];
    const [wx, wz] = wall, nx = -wx, nz = -wz;            // n = Blickrichtung aus dem Versteck
    const rot = Math.atan2(nx, nz);
    const depth = 0.7, width = 1.25, h = 2.15;
    const bx = xc + wx * (CS / 2 - depth / 2), bz = zc + wz * (CS / 2 - depth / 2); // Mittelpunkt des Möbels
    const type = zone === 'k' ? 'gap' : zone === 's' ? 'locker' : 'wardrobe';
    // lokale Achsen: u = entlang der Wand, n = nach vorn
    const ux = -nz, uz = nx;
    const at = (u, n) => [bx + ux * u + nx * n, bz + uz * u + nz * n];
    if (type === 'wardrobe') {
      woodBuf.box(bx, h / 2, bz, width, h, depth, rot);
      const [fx, fz] = at(0, depth / 2 + 0.01);
      frameBuf.box(fx, h / 2, fz, 0.02, h - 0.2, 0.02, rot);                       // Türspalt
      for (const u of [-0.12, 0.12]) { const [hx, hz] = at(u, depth / 2 + 0.03); metalBuf.box(hx, 1.05, hz, 0.03, 0.14, 0.03, rot); }
      for (let i = 0; i < 6; i++) { const [sx, sz] = at(0, depth / 2 + 0.012); frameBuf.box(sx, 1.45 + i * 0.07, sz, width - 0.25, 0.02, 0.01, rot); } // Lüftungsschlitze
      woodBuf.box(bx, h + 0.04, bz, width + 0.1, 0.08, depth + 0.08, rot);
    } else if (type === 'locker') {
      for (const u of [-0.31, 0.31]) {
        const [lx, lz] = at(u, 0);
        metalBuf.box(lx, h / 2, lz, 0.6, h, depth, rot);
        for (let i = 0; i < 5; i++) { const [sx, sz] = at(u, depth / 2 + 0.008); frameBuf.box(sx, 1.6 + i * 0.06, sz, 0.36, 0.018, 0.01, rot); }
        const [hx, hz] = at(u + 0.2, depth / 2 + 0.02); frameBuf.box(hx, 1.0, hz, 0.03, 0.18, 0.03, rot);
      }
    } else {
      // Mauerspalt: zwei Kistenstapel mit Brettern davor, dazwischen ein dunkler Spalt
      for (const u of [-0.45, 0.45]) {
        const [sx, sz] = at(u, 0);
        crateBuf.box(sx, 0.45, sz, 0.42, 0.9, depth, rot);
        crateBuf.box(sx, 1.3, sz, 0.4, 0.8, depth - 0.05, rot + 0.05);
        crateBuf.box(sx, 1.95, sz, 0.38, 0.5, depth - 0.1, rot - 0.04);
      }
      for (const y of [0.4, 1.2, 2.25]) { const [px, pz] = at(0, depth / 2 - 0.02); woodBuf.box(px, y, pz, width + 0.15, 0.12, 0.04, rot + (y - 1) * 0.04); }
    }
    this.addCollider(bx - (Math.abs(ux) * width + Math.abs(nx) * depth) / 2, bx + (Math.abs(ux) * width + Math.abs(nx) * depth) / 2,
      bz - (Math.abs(uz) * width + Math.abs(nz) * depth) / 2, bz + (Math.abs(uz) * width + Math.abs(nz) * depth) / 2);
    const name = { wardrobe: 'Schrank', locker: 'Spind', gap: 'Mauerspalt' }[type];
    this.hides.push({ cx, cz, type, name, x: bx, z: bz, nx, nz, yaw: Math.atan2(-nx, -nz), front: { x: xc + nx * 0.55, z: zc + nz * 0.55 } });
  }

  _addChair(x, z, rot) {
    if (!World.chairGeo) {
      const b = new GeoBuf();
      b.box(0, 0.45, 0, 0.45, 0.05, 0.45);
      b.box(0, 0.75, -0.21, 0.45, 0.55, 0.04);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(sx * 0.19, 0.22, sz * 0.19, 0.04, 0.45, 0.04);
      World.chairGeo = b.build();
    }
    const m = new THREE.Mesh(World.chairGeo, this.mats.wood);
    m.position.set(x, 0, z); m.rotation.y = rot;
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    this.chairs.push({ mesh: m, x, z, home: { x, z, rot } });
  }

  _buildDoor(cx, cz, frameBuf) {
    const x0 = cx * CS, x1 = x0 + CS, z0 = cz * CS, z1 = z0 + CS, xc = x0 + CS / 2, zc = z0 + CS / 2;
    const axis = this.isWallish(cx - 1, cz) && this.isWallish(cx + 1, cz) ? 'z' : 'x';
    const jw = 0.2, leafW = CS - 2 * jw;
    frameBuf.box(xc, (DOOR_H + WALL_H) / 2, zc, CS, WALL_H - DOOR_H, CS);
    const pivot = new THREE.Group();
    let box;
    const leaf = new THREE.Mesh(BOX, this.mats.door);
    leaf.castShadow = leaf.receiveShadow = true;
    const handle = new THREE.Mesh(BOX, this.mats.metal);
    if (axis === 'z') {
      frameBuf.box(x0 + jw / 2, DOOR_H / 2, zc, jw, DOOR_H, CS);
      frameBuf.box(x1 - jw / 2, DOOR_H / 2, zc, jw, DOOR_H, CS);
      this.addCollider(x0, x0 + jw, z0, z1); this.addCollider(x1 - jw, x1, z0, z1);
      pivot.position.set(x0 + jw, 0, zc);
      leaf.scale.set(leafW, DOOR_H - 0.02, 0.06); leaf.position.set(leafW / 2, DOOR_H / 2, 0);
      handle.scale.set(0.12, 0.03, 0.14); handle.position.set(leafW - 0.12, 1.0, 0);
      box = [x0 + jw, x1 - jw, zc - 0.06, zc + 0.06];
    } else {
      frameBuf.box(xc, DOOR_H / 2, z0 + jw / 2, CS, DOOR_H, jw);
      frameBuf.box(xc, DOOR_H / 2, z1 - jw / 2, CS, DOOR_H, jw);
      this.addCollider(x0, x1, z0, z0 + jw); this.addCollider(x0, x1, z1 - jw, z1);
      pivot.position.set(xc, 0, z0 + jw);
      leaf.scale.set(0.06, DOOR_H - 0.02, leafW); leaf.position.set(0, DOOR_H / 2, leafW / 2);
      handle.scale.set(0.14, 0.03, 0.12); handle.position.set(0, 1.0, leafW - 0.12);
      box = [xc - 0.06, xc + 0.06, z0 + jw, z1 - jw];
    }
    pivot.add(leaf, handle);
    this.group.add(pivot);
    const d = { cx, cz, x: xc, z: zc, axis, pivot, angle: 0, target: 0, open: false, speed: 3, box };
    this.doors.push(d);
    this.doorAt[this.idx(cx, cz)] = d;
  }

  _buildExit(cx, cz, a, b, n) {
    const xc = this.center(cx), faceZ = n[2] < 0 ? cz * CS : cz * CS + CS;
    const g = new THREE.Group();
    this.group.add(g);
    const mk = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
    const zf = faceZ + n[2] * 0.02;
    // Rahmen
    g.add(mk(this.mats.frame, 0.12, 2.45, 0.1, xc - 0.71, 1.22, zf));
    g.add(mk(this.mats.frame, 0.12, 2.45, 0.1, xc + 0.71, 1.22, zf));
    g.add(mk(this.mats.frame, 1.54, 0.12, 0.1, xc, 2.45, zf));
    // Seitliche Wandstücke neben dem Rahmen
    const wallM = this.mats.wall.l;
    g.add(mk(wallM, 0.05, 2.45, 0.02, xc - 0.75, 1.22, faceZ));
    g.add(mk(wallM, 0.05, 2.45, 0.02, xc + 0.75, 1.22, faceZ));
    const leaves = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(xc + side * 0.65, 0, faceZ - n[2] * 0.0 + n[2] * 0.03);
      const leaf = mk(this.mats.exitDoor, 0.65, 2.38, 0.07, -side * 0.325, 1.19, 0);
      pivot.add(leaf);
      g.add(pivot);
      leaves.push({ pivot, side });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), this.mats.exitSign);
    sign.position.set(xc, 2.7, faceZ + n[2] * 0.03);
    sign.rotation.y = Math.atan2(n[0], n[2]);
    g.add(sign);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2200 }));
    lamp.position.set(xc + 0.6, 1.3, faceZ + n[2] * 0.08);
    g.add(lamp);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(CS, WALL_H), this.mats.outside);
    outside.position.set(xc, WALL_H / 2, faceZ - n[2] * (CS - 0.1));
    outside.rotation.y = Math.atan2(n[0], n[2]);
    outside.visible = false;
    g.add(outside);
    this.exit = { cx, cz, x: xc, z: faceZ + n[2] * 0.7, faceZ, leaves, lamp, outside, unlocked: false, opening: 0 };
  }

  _buildLights(rooms) {
    const q = this.quality;
    // Prioritätsliste: Halle, Flur, Keller, Archiv
    const pick = (zone, nearX, nearZ) => {
      let best = null, bd = 1e9;
      for (const r of rooms) if (r.reg.zone === zone) { const d = Math.hypot(r.x - nearX, r.z - nearZ); if (d < bd) { bd = d; best = r; } }
      return best;
    };
    const cand = [
      [pick('l', this.start.x, this.start.z - 4), 0xffd9a0, 7],
      [pick('c', 30, 11), 0xd8e4ff, 5],
      [pick('k', 12, 30), 0x9fc0ff, 4],
      [pick('s', 48, 18), 0xffe0b0, 4],
    ];
    const count = q.lights;
    const used = new Set();
    for (let i = 0; i < cand.length && this.lights.length < count; i++) {
      const [room, color, intensity] = cand[i];
      if (!room || used.has(room)) continue;
      used.add(room);
      const L = new THREE.PointLight(color, intensity, 11, 1.6);
      L.position.set(room.x, WALL_H - 0.35, room.z);
      this.group.add(L);
      const bulb = new THREE.Mesh(BOX, this.mats.lampOn);
      bulb.scale.set(0.8, 0.03, 0.2);
      bulb.position.set(room.x, WALL_H - 0.08, room.z);
      this.group.add(bulb);
      this.lights.push({ light: L, bulb, base: intensity, color, t: Math.random() * 5, flick: 0 });
    }
  }

  update(dt, ghostPos) {
    for (const d of this.doors) {
      if (d.angle !== d.target) {
        const step = d.speed * dt, diff = d.target - d.angle;
        d.angle = Math.abs(diff) <= step ? d.target : d.angle + Math.sign(diff) * step;
        d.pivot.rotation.y = d.angle;
      }
    }
    for (const L of this.lights) {
      if (!L.light.visible) { L.bulb.visible = false; continue; }
      L.t -= dt;
      let near = 0;
      if (ghostPos) near = clamp(1 - Math.hypot(ghostPos.x - L.light.position.x, ghostPos.z - L.light.position.z) / 9, 0, 1);
      if (L.t <= 0) { L.flick = Math.random() < 0.35 + near * 0.6 ? 0.25 + Math.random() * 0.6 : 0; L.t = 1 + Math.random() * 4 * (1 - near); }
      let k = 1;
      if (L.flick > 0) { L.flick -= dt; k = Math.random() < 0.5 ? 0.05 : 1; }
      if (L.dead > 0) { L.dead -= dt; k = 0; }
      if (this.blackout) k = 0;
      else if (this.huntFlicker && Math.random() < 0.25) k = Math.random() * 0.3;
      L.light.intensity = L.base * k;
      L.light.color.setHex(this.huntFlicker ? 0xff5040 : L.color);
      L.bulb.visible = k > 0.5;
    }
    const e = this.exit;
    if (e && e.opening > 0) {
      e.opening = Math.min(1, e.opening + dt * 0.8);
      for (const l of e.leaves) l.pivot.rotation.y = l.side * e.opening * 1.6;
    }
  }

  resetDynamic() {
    for (const d of this.doors) { d.open = false; d.angle = d.target = 0; d.pivot.rotation.y = 0; }
    for (const L of this.lights) L.dead = 0;
    for (const c of this.chairs) { c.x = c.home.x; c.z = c.home.z; c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.set(0, c.home.rot, 0); c.anim = null; }
    const e = this.exit;
    e.unlocked = false; e.opening = 0; e.outside.visible = false; e.lamp.material.color.set(0xff2200);
    for (const l of e.leaves) l.pivot.rotation.y = 0;
  }

  setShadows(on) {
    for (const m of this.meshes) m.material.needsUpdate = true;
    this.group.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.shadowsOn = on;
  }

  // Mögliche Schlüsselverstecke, gruppiert nach Raum.
  keySpots() {
    const out = new Map();
    const startReg = this.regionAtPos(this.start.x, this.start.z);
    for (const reg of this.regions) {
      if (reg.id === startReg || reg.zone === 'c') continue;
      const list = [];
      for (const [cx, cz] of reg.cells) {
        const c = this.ch(cx, cz);
        const nearDoor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => this.ch(cx + dx, cz + dz) === 'D');
        if (nearDoor) continue;
        const x = this.center(cx), z = this.center(cz);
        if (c === 'T') list.push({ x, z, y: 0.86, w: 3 });
        else if (c === 'C') list.push({ x, z, y: 1.0, w: 2 });
        else if (FLOOR.has(c)) {
          const hugs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => !FLOOR.has(this.ch(cx + dx, cz + dz))).length;
          if (hugs > 0) list.push({ x, z, y: 0.12, w: hugs });
        }
      }
      if (list.length) out.set(reg.id, list);
    }
    return out;
  }
}
