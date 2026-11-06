// Alle Texturen werden zur Laufzeit auf Canvas gezeichnet: keine externen Dateien, keine CORS-Probleme.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './util.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function addNoise(ctx, w, h, rnd, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Flecken mit horizontaler Kachelung, damit keine Nähte entstehen.
function blotches(ctx, w, h, rnd, count, rgb, rMin, rMax, aMax) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h, r = rMin + rnd() * (rMax - rMin), a = aMax * (0.3 + rnd() * 0.7);
    for (const ox of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
}

function drips(ctx, w, h, rnd, count, rgb, maxLen) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, len = maxLen * (0.3 + rnd() * 0.7), wd = 1 + rnd() * 3;
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(${rgb},${0.35 + rnd() * 0.3})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, wd, len);
  }
}

function cracks(ctx, rnd, w, h, count, color) {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    let x = rnd() * w, y = rnd() * h;
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath(); ctx.moveTo(x, y);
    const n = 4 + Math.floor(rnd() * 6);
    for (let j = 0; j < n; j++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// --- Wände (256x512 = 1,5 m x 3 m) ---
function wallOffice() {
  const w = 256, h = 512, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(11);
  x.fillStyle = '#3c4535'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 32) { x.fillStyle = 'rgba(255,255,220,0.05)'; x.fillRect(i, 0, 14, h); }
  x.fillStyle = 'rgba(210,200,150,0.08)';
  for (let yy = 20; yy < h; yy += 48) for (let xx = 16; xx < w; xx += 32) {
    const oy = ((xx / 32) % 2) * 24;
    x.beginPath(); x.moveTo(xx, yy + oy - 9); x.lineTo(xx + 7, yy + oy); x.lineTo(xx, yy + oy + 9); x.lineTo(xx - 7, yy + oy); x.fill();
  }
  blotches(x, w, h, r, 14, '60,45,20', 15, 70, 0.35);
  drips(x, w, h, r, 10, '40,30,15', 260);
  x.fillStyle = '#211910'; x.fillRect(0, h - 30, w, 30);
  x.fillStyle = '#3a2c1d'; x.fillRect(0, h - 32, w, 3);
  blotches(x, w, h, r, 6, '0,0,0', 30, 90, 0.4);
  addNoise(x, w, h, r, 22);
  return toTexture(c);
}

function wallCorridor() {
  const w = 256, h = 512, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(22);
  x.fillStyle = '#8f8a78'; x.fillRect(0, 0, w, h);
  blotches(x, w, h * 0.65, r, 16, '90,80,50', 20, 80, 0.3);
  drips(x, w, h, r, 14, '70,60,35', 300);
  const wy = h * 0.67;
  x.fillStyle = '#46362a'; x.fillRect(0, wy, w, h - wy);
  x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 3;
  for (let i = 0; i <= w; i += 64) { x.strokeRect(i + 8, wy + 18, 48, h - wy - 50); }
  x.fillStyle = '#2b2018'; x.fillRect(0, wy - 6, w, 10);
  x.fillStyle = '#1c150f'; x.fillRect(0, h - 22, w, 22);
  blotches(x, w, h, r, 8, '0,0,0', 30, 100, 0.35);
  addNoise(x, w, h, r, 20);
  return toTexture(c);
}

function wallLobby() {
  const w = 256, h = 512, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(33);
  x.fillStyle = '#4a1d1b'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(200,160,90,0.12)'; x.lineWidth = 2;
  for (let yy = 30; yy < h * 0.65; yy += 56) for (let xx = 0; xx <= w; xx += 64) {
    x.beginPath(); x.ellipse(xx + 32, yy, 12, 20, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(xx + 32, yy - 26); x.lineTo(xx + 32, yy + 26); x.stroke();
  }
  blotches(x, w, h, r, 12, '20,5,5', 20, 80, 0.45);
  drips(x, w, h, r, 9, '15,5,5', 280);
  const wy = h * 0.66;
  x.fillStyle = '#2e2017'; x.fillRect(0, wy, w, h - wy);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
  for (let i = 0; i <= w; i += 85) x.strokeRect(i + 10, wy + 20, 64, h - wy - 54);
  x.fillStyle = '#5a4630'; x.fillRect(0, wy - 5, w, 6);
  addNoise(x, w, h, r, 18);
  return toTexture(c);
}

function wallStorage() {
  const w = 256, h = 512, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(44);
  x.fillStyle = '#69705f'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#394540'; x.fillRect(0, h * 0.58, w, h * 0.42);
  x.fillStyle = '#26302c'; x.fillRect(0, h * 0.58 - 4, w, 5);
  blotches(x, w, h, r, 18, '150,150,135', 8, 34, 0.35);
  blotches(x, w, h, r, 12, '40,35,25', 20, 70, 0.4);
  drips(x, w, h, r, 16, '50,40,25', 340);
  cracks(x, r, w, h, 6, 'rgba(20,20,20,0.6)');
  addNoise(x, w, h, r, 30);
  return toTexture(c);
}

function wallKeller() {
  const w = 256, h = 512, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(55);
  x.fillStyle = '#1e1714'; x.fillRect(0, 0, w, h);
  const bh = 26, bw = 64;
  for (let row = 0; row * bh < h; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col * bw < w + bw; col++) {
      const v = 0.75 + r() * 0.5;
      x.fillStyle = `rgb(${Math.floor(78 * v)},${Math.floor(44 * v)},${Math.floor(34 * v)})`;
      x.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  const g = x.createLinearGradient(0, h, 0, h * 0.4);
  g.addColorStop(0, 'rgba(5,10,8,0.85)'); g.addColorStop(1, 'rgba(5,10,8,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  blotches(x, w, h, r, 10, '30,50,30', 20, 60, 0.4);
  drips(x, w, h, r, 12, '10,15,10', 400);
  addNoise(x, w, h, r, 26);
  return toTexture(c);
}

// --- Böden & Decken (256x256) ---
function floorCarpet() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(66);
  x.fillStyle = '#2b2f37'; x.fillRect(0, 0, w, w);
  x.strokeStyle = 'rgba(120,110,90,0.08)'; x.lineWidth = 2;
  for (let i = 0; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  blotches(x, w, w, r, 10, '40,25,15', 10, 50, 0.45);
  addNoise(x, w, w, r, 40);
  return toTexture(c);
}

function floorTiles() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(77);
  x.fillStyle = '#2a2723'; x.fillRect(0, 0, w, w);
  const t = 64;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = 0.85 + r() * 0.25;
    x.fillStyle = `rgb(${Math.floor(110 * v)},${Math.floor(104 * v)},${Math.floor(90 * v)})`;
    x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
  }
  cracks(x, r, w, w, 5, 'rgba(20,18,15,0.7)');
  blotches(x, w, w, r, 12, '50,40,25', 10, 50, 0.4);
  addNoise(x, w, w, r, 24);
  return toTexture(c);
}

function floorMarble() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(88);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    x.fillStyle = (i + j) % 2 ? '#191818' : '#aaa496';
    x.fillRect(i * 128, j * 128, 128, 128);
  }
  cracks(x, r, w, w, 10, 'rgba(90,85,75,0.35)');
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2;
  x.strokeRect(0, 0, 128, 128); x.strokeRect(128, 128, 128, 128); x.strokeRect(128, 0, 128, 128); x.strokeRect(0, 128, 128, 128);
  blotches(x, w, w, r, 10, '40,30,20', 15, 60, 0.45);
  addNoise(x, w, w, r, 20);
  return toTexture(c);
}

function floorConcrete(seed = 99, base = '#55585a') {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(seed);
  x.fillStyle = base; x.fillRect(0, 0, w, w);
  blotches(x, w, w, r, 20, '30,30,28', 10, 60, 0.35);
  blotches(x, w, w, r, 10, '120,120,110', 5, 30, 0.15);
  cracks(x, r, w, w, 6, 'rgba(15,15,15,0.7)');
  addNoise(x, w, w, r, 34);
  return toTexture(c);
}

function floorKeller() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(111);
  x.fillStyle = '#2d302e'; x.fillRect(0, 0, w, w);
  blotches(x, w, w, r, 14, '8,12,10', 20, 70, 0.6);
  blotches(x, w, w, r, 10, '60,55,40', 6, 25, 0.25);
  cracks(x, r, w, w, 8, 'rgba(5,5,5,0.8)');
  addNoise(x, w, w, r, 30);
  return toTexture(c);
}

function ceilingTiles() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(122);
  x.fillStyle = '#7c7a71'; x.fillRect(0, 0, w, w);
  addNoise(x, w, w, r, 30);
  blotches(x, w, w, r, 6, '90,65,30', 20, 70, 0.5);
  x.fillStyle = '#4a4740';
  x.fillRect(0, 0, w, 5); x.fillRect(0, 0, 5, w); x.fillRect(0, 126, w, 4); x.fillRect(126, 0, 4, w);
  return toTexture(c);
}

function wood() {
  const w = 256, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(133);
  x.fillStyle = '#4c311d'; x.fillRect(0, 0, w, w);
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${r() > 0.5 ? '20,10,5' : '110,75,45'},${0.15 + r() * 0.25})`;
    x.lineWidth = 1 + r() * 2;
    const y = r() * w;
    x.beginPath(); x.moveTo(0, y);
    for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, y + Math.sin(xx * 0.03 + i) * 4);
    x.stroke();
  }
  addNoise(x, w, w, r, 16);
  return toTexture(c);
}

function metal() {
  const w = 128, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(144);
  x.fillStyle = '#4b5154'; x.fillRect(0, 0, w, w);
  x.strokeStyle = 'rgba(200,200,200,0.12)';
  for (let i = 0; i < 40; i++) { x.beginPath(); const y = r() * w; x.moveTo(r() * w, y); x.lineTo(r() * w, y + (r() - 0.5) * 8); x.stroke(); }
  blotches(x, w, w, r, 8, '90,45,15', 5, 25, 0.5);
  addNoise(x, w, w, r, 20);
  return toTexture(c);
}

function crate() {
  const w = 128, c = makeCanvas(w, w), x = c.getContext('2d'), r = mulberry32(155);
  x.fillStyle = '#6b5236'; x.fillRect(0, 0, w, w);
  for (let i = 0; i < w; i += 21) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, i, w, 2); }
  x.strokeStyle = '#3a2a19'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, w - 8);
  x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, w - 8); x.stroke();
  addNoise(x, w, w, r, 26);
  return toTexture(c);
}

function door() {
  const w = 128, h = 256, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(166);
  x.fillStyle = '#3d281a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.15})`; x.fillRect(0, r() * h, w, 1 + r() * 2); }
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 4;
  x.strokeRect(16, 16, w - 32, h * 0.4); x.strokeRect(16, h * 0.5, w - 32, h * 0.42);
  x.strokeStyle = 'rgba(160,120,80,0.15)'; x.lineWidth = 2;
  x.strokeRect(20, 20, w - 40, h * 0.4 - 8); x.strokeRect(20, h * 0.5 + 4, w - 40, h * 0.42 - 8);
  blotches(x, w, h, r, 6, '10,5,0', 10, 40, 0.4);
  addNoise(x, w, h, r, 18);
  return toTexture(c);
}

function exitDoor() {
  const w = 128, h = 256, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(177);
  x.fillStyle = '#3b1514'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; x.strokeRect(8, 8, w - 16, h - 16);
  blotches(x, w, h, r, 12, '90,60,40', 5, 24, 0.35);
  x.fillStyle = '#6d6d6a'; x.fillRect(10, h * 0.47, w - 20, 12);
  x.fillStyle = '#2a2a28'; x.fillRect(10, h * 0.47 + 10, w - 20, 3);
  x.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(16 + i * 19, 16, 2, 0, 7); x.fill(); x.beginPath(); x.arc(16 + i * 19, h - 16, 2, 0, 7); x.fill(); }
  addNoise(x, w, h, r, 22);
  return toTexture(c, false);
}

function nightWindow() {
  const w = 128, h = 192, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(188);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d2c3e'); g.addColorStop(1, '#070b10');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const m = x.createRadialGradient(w * 0.75, h * 0.2, 2, w * 0.75, h * 0.2, 40);
  m.addColorStop(0, 'rgba(220,230,255,0.9)'); m.addColorStop(0.2, 'rgba(160,180,220,0.4)'); m.addColorStop(1, 'rgba(160,180,220,0)');
  x.fillStyle = m; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#020305';
  function branch(px, py, ang, len, wd) {
    if (len < 4) return;
    const nx = px + Math.cos(ang) * len, ny = py + Math.sin(ang) * len;
    x.lineWidth = wd; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
    branch(nx, ny, ang - 0.4 - r() * 0.3, len * 0.7, wd * 0.7);
    branch(nx, ny, ang + 0.3 + r() * 0.3, len * 0.65, wd * 0.7);
  }
  branch(w * 0.15, h, -Math.PI / 2 - 0.1, 50, 6);
  x.fillStyle = 'rgba(180,200,230,0.25)';
  for (let i = 0; i < 40; i++) x.fillRect(r() * w, r() * h, 1, 2 + r() * 5);
  x.strokeStyle = '#120d09'; x.lineWidth = 6;
  x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  return toTexture(c, false);
}

function exitSign() {
  const w = 256, h = 80, c = makeCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#0c6a37'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#eafff0'; x.font = 'bold 44px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('AUSGANG', w / 2 + 14, h / 2 + 2);
  x.beginPath(); x.moveTo(14, h / 2); x.lineTo(34, h / 2 - 16); x.lineTo(34, h / 2 + 16); x.fill();
  return toTexture(c, false);
}

function glow() {
  const w = 64, c = makeCanvas(w, w), x = c.getContext('2d');
  const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
  return toTexture(c, false);
}

function paper() {
  const w = 64, h = 84, c = makeCanvas(w, h), x = c.getContext('2d'), r = mulberry32(199);
  x.fillStyle = '#bdb8a8'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(40,40,40,0.5)';
  for (let y = 10; y < h - 8; y += 6) x.fillRect(6, y, 20 + r() * 30, 2);
  blotches(x, w, h, r, 3, '100,80,40', 5, 20, 0.5);
  return toTexture(c, false);
}

export function createTextures() {
  return {
    wall: { o: wallOffice(), c: wallCorridor(), l: wallLobby(), s: wallStorage(), k: wallKeller() },
    floor: { o: floorCarpet(), c: floorTiles(), l: floorMarble(), s: floorConcrete(), k: floorKeller() },
    ceiling: { def: ceilingTiles(), k: floorConcrete(212, '#3a3c3b') },
    wood: wood(), metal: metal(), crate: crate(), door: door(), exitDoor: exitDoor(),
    window: nightWindow(), exitSign: exitSign(), glow: glow(), paper: paper(),
    concrete: floorConcrete(233, '#5d5f5c'),
  };
}

// Körnungs-Overlay für das HUD (als Daten-URL).
export function grainDataURL() {
  const w = 128, c = makeCanvas(w, w), x = c.getContext('2d');
  const img = x.createImageData(w, w);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 40;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
