import { store } from './util.js';

const KEY = 'f5s_settings_v1';

export const settings = Object.assign({
  quality: 'auto',       // auto | low | medium | high
  volume: 0.8,
  sensitivity: 1.0,
  reduceScares: false,
  invertY: false,
  showFps: false,
  autoFullscreen: true,
}, store.get(KEY, {}));

export function saveSettings() { store.set(KEY, settings); }

// Ermittelt eine sinnvolle Startqualität für das Gerät.
export function detectQuality(isTouch) {
  // Safari meldet weder deviceMemory noch die echte Kernzahl: im Zweifel „Mittel“,
  // die dynamische Auflösung und Stufenabsenkung fangen schwache Geräte ab.
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (isTouch) return (mem <= 2 || cores <= 2) ? 'low' : 'medium';
  if (cores <= 2) return 'medium';
  return 'high';
}

export const QUALITY = {
  low:    { maxDpr: 1.0, minScale: 0.5, maxScale: 0.85, startScale: 0.75, shadows: false, lights: 1, fogDensity: 0.085, far: 30, grain: false },
  medium: { maxDpr: 1.5, minScale: 0.55, maxScale: 1.0, startScale: 0.9, shadows: false, lights: 2, fogDensity: 0.07, far: 40, grain: true },
  high:   { maxDpr: 2.0, minScale: 0.6, maxScale: 1.0, startScale: 1.0, shadows: true, lights: 4, fogDensity: 0.06, far: 55, grain: true },
};
