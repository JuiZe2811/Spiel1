import { $, $$ } from './util.js';

export class UI {
  constructor(game) {
    this.g = game;
    this.screens = $$('.screen');
    this.stack = [];
    this.msgT = 0;
    this.cache = {};
    this.el = {
      hud: $('#hud'), touch: $('#touch'), keyCount: $('#hud-key-count'), pips: $$('#hud-keys .pip'),
      objective: $('#hud-objective'), msg: $('#hud-msg'), prompt: $('#hud-prompt'), stamina: $('#hud-stamina'),
      staminaBar: $('#hud-stamina i'), cross: $('#hud-cross'), crossTxt: $('#hud-cross-txt'), lock: $('#hud-lock'),
      fps: $('#hud-fps'), threat: $('#fx-threat'), flash: $('#fx-flash'), scare: $('#scare-face'), scareImg: $('#scare-img'),
      fade: $('#fx-fade'), tInteract: $('#t-interact'), tLight: $('#t-light'), tCross: $('#t-cross'), tCrossCd: $('#t-cross .cd'),
      tSprint: $('#t-sprint'), tFlare: $('#t-flare'), tFlareN: $('#t-flare .badge'), tHint: $('#t-hint'),
      hint: $('#hud-hint'), hintArrow: $('#hud-hint-arrow'), hintDist: $('#hud-hint-dist'),
      invFlare: $('#hud-flares'), invFlareN: $('#hud-flares b'), invHint: $('#hud-hintkey b'),
    };
  }

  show(id, push = true) {
    const cur = this.current;
    if (push && cur && cur !== id) this.stack.push(cur);
    if (!push) this.stack = [];
    this.screens.forEach((s) => { s.hidden = s.id !== id; });
    this.current = id;
  }
  back() {
    const prev = this.stack.pop();
    if (!prev) { this.hideScreens(); return; }
    this.screens.forEach((s) => { s.hidden = s.id !== prev; });
    this.current = prev;
  }
  hideScreens() { this.screens.forEach((s) => { s.hidden = true; }); this.current = null; this.stack = []; }

  setPlayMode(playing, mode) {
    this.el.hud.hidden = !playing;
    this.el.touch.hidden = !(playing && mode === 'touch');
    document.body.classList.toggle('touch-mode', mode === 'touch');
    document.body.classList.toggle('desk-mode', mode !== 'touch');
  }

  _set(key, el, prop, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    if (prop === 'text') el.textContent = val; else if (prop === 'hidden') el.hidden = val;
    else if (prop === 'cssvar') el.style.setProperty('--p', val); else el.style[prop] = val;
  }

  setKeys(n, total = 5) {
    this._set('keys', this.el.keyCount, 'text', `${n}/${total}`);
    this.el.pips.forEach((p, i) => p.classList.toggle('got', i < n));
  }
  objective(t) { this._set('obj', this.el.objective, 'text', t); }
  message(t, dur = 3) {
    this.el.msg.textContent = t;
    this.el.msg.classList.add('show');
    this.msgT = dur;
  }
  prompt(text) {
    // Desktop: Hinweistext; Touch: Schaltfläche INTERAGIEREN/AUFNEHMEN
    const mode = this.g.input.mode;
    this._set('prompt', this.el.prompt, 'text', text && mode !== 'touch' ? `E — ${text.desk}` : '');
    this._set('tint', this.el.tInteract, 'hidden', !text);
    if (text) this._set('tintTxt', this.el.tInteract, 'text', text.touch);
  }
  stamina(v, exhausted) {
    this._set('stam', this.el.staminaBar, 'width', `${Math.round(v * 100)}%`);
    this._set('stamH', this.el.stamina, 'opacity', v > 0.99 ? '0' : '1');
    this.el.stamina.classList.toggle('low', exhausted);
  }
  crossState(active, cooldown) {
    const ready = !active && cooldown <= 0;
    const txt = active ? 'AKTIV' : ready ? 'BEREIT' : `${Math.ceil(cooldown)} s`;
    this._set('crossTxt', this.el.crossTxt, 'text', txt);
    this._set('crossCd', this.el.tCrossCd, 'text', active ? '' : ready ? '' : `${Math.ceil(cooldown)}`);
    this.el.cross.classList.toggle('ready', ready);
    this.el.cross.classList.toggle('active', active);
    this.el.tCross.classList.toggle('cooling', !ready && !active);
    this.el.tCross.classList.toggle('on', active);
    this._set('crossP', this.el.tCross, 'cssvar', active || ready ? 100 : Math.round((1 - cooldown / 20) * 100));
  }
  toggles(light, sprint) {
    this.el.tLight.classList.toggle('on', light);
    this.el.tSprint.classList.toggle('on', sprint);
  }
  inventory(flares, hintCd, hintActive) {
    this._set('flN', this.el.tFlareN, 'text', String(flares));
    this._set('flN2', this.el.invFlareN, 'text', `${flares}`);
    this.el.tFlare.classList.toggle('empty', flares <= 0);
    this.el.invFlare.classList.toggle('empty', flares <= 0);
    const p = hintActive ? 100 : Math.round((1 - hintCd / 30) * 100);
    this._set('hintP', this.el.tHint, 'cssvar', p);
    this.el.tHint.classList.toggle('cooling', hintCd > 0 && !hintActive);
    this.el.tHint.classList.toggle('on', hintActive);
    this._set('hintTxt', this.el.invHint, 'text', hintActive ? 'AKTIV' : hintCd > 0 ? `${Math.ceil(hintCd)} s` : 'BEREIT');
  }
  hint(show, deg = 0, dist = 0) {
    this._set('hintShow', this.el.hint, 'hidden', !show);
    if (!show) return;
    this.el.hintArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    this._set('hintDist', this.el.hintDist, 'text', `${Math.round(dist)} m`);
  }
  lockHint(show) { this._set('lock', this.el.lock, 'hidden', !show); }
  threat(v) { this._set('threat', this.el.threat, 'opacity', v.toFixed(2)); }
  fps(t) { this._set('fps', this.el.fps, 'text', t); }

  showScareFace(strength = 1, src = null) {
    const el = this.el.scare;
    this.el.scareImg.src = src || this.g.face.dataURL;
    el.style.setProperty('--s', strength);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  hideScareFace() { this.el.scare.classList.remove('show'); }
  flash(strength) {
    const el = this.el.flash;
    el.style.setProperty('--a', strength);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  fade(on, color = '#000') { this.el.fade.style.background = color; this.el.fade.classList.toggle('on', on); }

  update(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.el.msg.classList.remove('show'); }
  }
}
