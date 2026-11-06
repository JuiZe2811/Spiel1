// Eingabe: Tastatur + Maus (Pointer Lock oder Ziehen) sowie Multitouch (Joystick, Umsehen, Tasten).
import { clamp } from './util.js';

export function detectTouchPrimary() {
  const mm = (q) => window.matchMedia && window.matchMedia(q).matches;
  const tp = navigator.maxTouchPoints || 0;
  const ua = navigator.userAgent || '';
  const iPadOS = /Macintosh/.test(ua) && tp > 1;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua);
  return mm('(pointer: coarse)') || (mm('(hover: none)') && tp > 0) || iPadOS || (mobileUA && tp > 0);
}

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight', 'KeyC', 'KeyE', 'KeyF', 'KeyQ', 'Space']);

export class Input {
  constructor({ canvas, joyZone, lookZone, joyBase, joyKnob, buttons }) {
    this.canvas = canvas;
    this.keys = new Set();
    this.actions = [];
    this.lookDX = 0; this.lookDY = 0;
    this.joy = { x: 0, y: 0 };
    this.sprintToggle = false; this.crouchToggle = false;
    this.active = false;            // nur während des Spiels Eingaben sammeln
    this.mode = detectTouchPrimary() ? 'touch' : 'desktop';
    this.onModeChange = null;
    this.pointerLocked = false;
    this.dragging = false;
    this.joyId = null; this.lookId = null;
    this.joyBase = joyBase; this.joyKnob = joyKnob;
    this.buttons = buttons;

    // --- Tastatur ---
    window.addEventListener('keydown', (e) => {
      if (this.active && GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) { return; }
      this.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && this.mode !== 'desktop') this._setMode('desktop');
      if (!this.active) { if (e.code === 'Escape' || e.code === 'KeyP') this.actions.push('pause'); return; }
      const map = { KeyF: 'light', KeyQ: 'cross', KeyE: 'interact', Escape: 'pause', KeyP: 'pause' };
      if (map[e.code]) this.actions.push(map[e.code]);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());

    // --- Maus ---
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this.lockTime = performance.now();
      if (this.onLockChange) this.onLockChange(this.pointerLocked);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active || this.mode !== 'desktop') return;
      if (!this.pointerLocked) { this.requestLock(); this.dragging = true; }
    });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.active) return;
      if (this.pointerLocked || this.dragging) {
        // Browser liefern direkt nach dem Fangen der Maus teils riesige Sprünge: verwerfen.
        const mx = e.movementX || 0, my = e.movementY || 0;
        if (performance.now() - (this.lockTime || 0) < 120 || Math.abs(mx) > 280 || Math.abs(my) > 280) return;
        this.lookDX += mx;
        this.lookDY += my;
      }
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && this.mode !== 'touch') this._setMode('touch');
    }, true);
    let mouseMoves = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && this.mode !== 'desktop' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 0)) {
        if (++mouseMoves > 8) { mouseMoves = 0; this._setMode('desktop'); }
      }
    });

    // --- Touch ---
    const opts = { passive: false };
    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.joyId !== null) break;
        this.joyId = t.identifier;
        this._joyStart(t.clientX, t.clientY);
      }
    }, opts);
    lookZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.lookId !== null) break;
        this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY };
      }
    }, opts);
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) this._joyMove(t.clientX, t.clientY);
        else if (t.identifier === this.lookId) {
          this.lookDX += (t.clientX - this.lookLast.x) * 1.9;
          this.lookDY += (t.clientY - this.lookLast.y) * 1.9;
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      if (this.active) e.preventDefault();
    }, opts);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) this._joyEnd();
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    window.addEventListener('touchend', end, opts);
    window.addEventListener('touchcancel', end, opts);

    for (const btn of buttons) {
      const act = btn.dataset.act;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('pressed');
        this._press(act);
      }, opts);
      btn.addEventListener('touchend', (e) => { e.preventDefault(); btn.classList.remove('pressed'); }, opts);
      btn.addEventListener('touchcancel', () => btn.classList.remove('pressed'));
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); this._press(act); });
    }
  }

  _setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
    this.releaseAll();
    if (this.onModeChange) this.onModeChange(m);
  }

  _press(act) {
    if (!this.active && act !== 'pause') return;
    if (act === 'sprint') { this.sprintToggle = !this.sprintToggle; return; }
    if (act === 'crouch') { this.crouchToggle = !this.crouchToggle; if (this.crouchToggle) this.sprintToggle = false; return; }
    this.actions.push(act);
  }

  _joyStart(x, y) {
    const r = this.joyBase.offsetWidth / 2;
    // Basis dort zentrieren, wo der Daumen aufsetzt (aber im sichtbaren Bereich)
    const cx = clamp(x, r + 8, window.innerWidth * 0.5 - r), cy = clamp(y, r + 60, window.innerHeight - r - 8);
    this.joyOrigin = { x: cx, y: cy };
    this.joyBase.style.left = `${cx - r}px`; this.joyBase.style.top = `${cy - r}px`;
    this.joyBase.style.bottom = 'auto';
    this.joyBase.classList.add('active');
    this._joyMove(x, y);
  }
  _joyMove(x, y) {
    const R = this.joyBase.offsetWidth * 0.42;
    let dx = x - this.joyOrigin.x, dy = y - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / R, ny = -dy / R;
    const m = Math.hypot(nx, ny);
    if (m < 0.12) { nx = ny = 0; } else { const k = (m - 0.12) / 0.88 / m; nx *= k; ny *= k; }
    this.joy.x = nx; this.joy.y = ny;
  }
  _joyEnd() {
    this.joyId = null; this.joy.x = this.joy.y = 0;
    this.joyKnob.style.transform = 'translate(0px, 0px)';
    this.joyBase.classList.remove('active');
    this.joyBase.style.left = ''; this.joyBase.style.top = ''; this.joyBase.style.bottom = '';
  }

  releaseAll() {
    this.keys.clear();
    this._joyEnd();
    this.lookId = null; this.dragging = false;
    this.lookDX = this.lookDY = 0;
    this.buttons.forEach((b) => b.classList.remove('pressed'));
  }

  requestLock() {
    if (this.mode !== 'desktop' || !this.canvas.requestPointerLock) return;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch { /* Pointer Lock nicht verfügbar: Ziehen zum Umsehen funktioniert trotzdem */ }
  }
  exitLock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }

  get moveX() {
    let x = this.joy.x;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    return clamp(x, -1, 1);
  }
  get moveY() {
    let y = this.joy.y;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    return clamp(y, -1, 1);
  }
  get sprint() { return this.sprintToggle || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get crouch() { return this.crouchToggle || this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC'); }

  consumeLook() { const r = [this.lookDX, this.lookDY]; this.lookDX = this.lookDY = 0; return r; }
  consumeActions() { const a = this.actions; this.actions = []; return a; }
}
